// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow
/// @notice Holds a buyer's stablecoin until the seller delivers. The buyer releases, or stays
/// silent through the inspection window, or disputes and the arbiter splits the funds.
contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        None,
        Funded,
        Delivered,
        Disputed,
        Released,
        Refunded,
        Resolved
    }

    struct Deal {
        address buyer;
        address seller;
        IERC20 token;
        uint256 amount;
        uint64 deliverBy;
        uint64 inspectUntil;
        Status status;
    }

    address public immutable arbiter;
    uint64 public immutable inspectionPeriod;

    uint256 public nextId = 1;
    mapping(uint256 => Deal) public deals;

    event Opened(uint256 indexed id, address indexed buyer, address indexed seller, address token, uint256 amount, uint64 deliverBy);
    event Delivered(uint256 indexed id, uint64 inspectUntil);
    event Released(uint256 indexed id, uint256 amount);
    event Refunded(uint256 indexed id, uint256 amount);
    event Disputed(uint256 indexed id);
    event Resolved(uint256 indexed id, uint256 toSeller, uint256 toBuyer);

    error InvalidDeal();
    error NotAllowed();
    error WrongStatus(Status status);
    error TooEarly();
    error TooLate();
    error UnsupportedToken();

    constructor(address arbiter_, uint64 inspectionPeriod_) {
        if (arbiter_ == address(0) || inspectionPeriod_ == 0) revert InvalidDeal();
        arbiter = arbiter_;
        inspectionPeriod = inspectionPeriod_;
    }

    function open(address seller, IERC20 token, uint256 amount, uint64 deliverBy)
        external
        nonReentrant
        returns (uint256 id)
    {
        if (seller == address(0) || seller == msg.sender || seller == arbiter || msg.sender == arbiter) {
            revert InvalidDeal();
        }
        if (amount == 0 || deliverBy <= block.timestamp) revert InvalidDeal();

        id = nextId++;
        deals[id] = Deal(msg.sender, seller, token, amount, deliverBy, 0, Status.Funded);

        // Fee-on-transfer tokens would leave the deal underfunded.
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedToken();

        emit Opened(id, msg.sender, seller, address(token), amount, deliverBy);
    }

    function markDelivered(uint256 id) external {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotAllowed();
        _expect(d, Status.Funded);
        if (block.timestamp > d.deliverBy) revert TooLate();

        d.status = Status.Delivered;
        d.inspectUntil = uint64(block.timestamp) + inspectionPeriod;
        emit Delivered(id, d.inspectUntil);
    }

    function release(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotAllowed();
        if (d.status != Status.Funded && d.status != Status.Delivered) revert WrongStatus(d.status);
        _payout(id, d, Status.Released, d.seller);
    }

    /// @notice Seller collects once the inspection window passes without a dispute.
    function claim(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotAllowed();
        _expect(d, Status.Delivered);
        if (block.timestamp <= d.inspectUntil) revert TooEarly();
        _payout(id, d, Status.Released, d.seller);
    }

    /// @notice Buyer takes the money back if the seller never marked delivery in time.
    function refundExpired(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotAllowed();
        _expect(d, Status.Funded);
        if (block.timestamp <= d.deliverBy) revert TooEarly();
        _payout(id, d, Status.Refunded, d.buyer);
    }

    /// @notice Seller can always give the buyer their money back.
    function refund(uint256 id) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != d.seller) revert NotAllowed();
        if (d.status != Status.Funded && d.status != Status.Delivered && d.status != Status.Disputed) {
            revert WrongStatus(d.status);
        }
        _payout(id, d, Status.Refunded, d.buyer);
    }

    function dispute(uint256 id) external {
        Deal storage d = _deal(id);
        if (msg.sender != d.buyer) revert NotAllowed();
        _expect(d, Status.Delivered);
        if (block.timestamp > d.inspectUntil) revert TooLate();

        d.status = Status.Disputed;
        emit Disputed(id);
    }

    function resolve(uint256 id, uint256 toSeller) external nonReentrant {
        Deal storage d = _deal(id);
        if (msg.sender != arbiter) revert NotAllowed();
        _expect(d, Status.Disputed);
        if (toSeller > d.amount) revert InvalidDeal();

        uint256 toBuyer = d.amount - toSeller;
        d.status = Status.Resolved;
        if (toSeller > 0) d.token.safeTransfer(d.seller, toSeller);
        if (toBuyer > 0) d.token.safeTransfer(d.buyer, toBuyer);
        emit Resolved(id, toSeller, toBuyer);
    }

    function _payout(uint256 id, Deal storage d, Status next, address to) private {
        d.status = next;
        d.token.safeTransfer(to, d.amount);
        if (next == Status.Released) emit Released(id, d.amount);
        else emit Refunded(id, d.amount);
    }

    function _deal(uint256 id) private view returns (Deal storage d) {
        d = deals[id];
        if (d.status == Status.None) revert InvalidDeal();
    }

    function _expect(Deal storage d, Status s) private view {
        if (d.status != s) revert WrongStatus(d.status);
    }
}
