// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Escrow} from "../src/Escrow.sol";

contract MockUSD is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FeeToken is ERC20 {
    constructor() ERC20("Fee", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            uint256 fee = value / 100;
            super._update(from, address(0xFEE), fee);
            value -= fee;
        }
        super._update(from, to, value);
    }
}

contract EscrowTest is Test {
    Escrow escrow;
    MockUSD usd;

    address buyer = makeAddr("buyer");
    address seller = makeAddr("seller");
    address arbiter = makeAddr("arbiter");

    uint256 constant AMOUNT = 500e6;
    uint64 constant INSPECTION = 3 days;

    function setUp() public {
        escrow = new Escrow(arbiter, INSPECTION);
        usd = new MockUSD();
        usd.mint(buyer, 1_000e6);
        vm.prank(buyer);
        usd.approve(address(escrow), type(uint256).max);
    }

    function _open() internal returns (uint256 id) {
        vm.prank(buyer);
        id = escrow.open(seller, usd, AMOUNT, uint64(block.timestamp + 7 days));
    }

    function _status(uint256 id) internal view returns (Escrow.Status s) {
        (,,,,,, s) = escrow.deals(id);
    }

    function test_open_holdsFunds() public {
        uint256 id = _open();
        assertEq(usd.balanceOf(address(escrow)), AMOUNT);
        assertEq(uint8(_status(id)), uint8(Escrow.Status.Funded));
    }

    function test_buyerRelease_paysSeller() public {
        uint256 id = _open();
        vm.prank(seller);
        escrow.markDelivered(id);
        vm.prank(buyer);
        escrow.release(id);

        assertEq(usd.balanceOf(seller), AMOUNT);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }

    function test_releaseTwice_reverts() public {
        uint256 id = _open();
        vm.prank(buyer);
        escrow.release(id);

        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSelector(Escrow.WrongStatus.selector, Escrow.Status.Released));
        escrow.release(id);
    }

    function test_silentBuyer_sellerClaimsAfterInspection() public {
        uint256 id = _open();
        vm.prank(seller);
        escrow.markDelivered(id);

        vm.prank(seller);
        vm.expectRevert(Escrow.TooEarly.selector);
        escrow.claim(id);

        vm.warp(block.timestamp + INSPECTION + 1);
        vm.prank(seller);
        escrow.claim(id);
        assertEq(usd.balanceOf(seller), AMOUNT);
    }

    function test_noDelivery_buyerRefundedAfterDeadline() public {
        uint256 id = _open();

        vm.prank(buyer);
        vm.expectRevert(Escrow.TooEarly.selector);
        escrow.refundExpired(id);

        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(buyer);
        escrow.refundExpired(id);
        assertEq(usd.balanceOf(buyer), 1_000e6);
    }

    function test_lateDelivery_reverts() public {
        uint256 id = _open();
        vm.warp(block.timestamp + 7 days + 1);
        vm.prank(seller);
        vm.expectRevert(Escrow.TooLate.selector);
        escrow.markDelivered(id);
    }

    function test_disputeAfterInspection_reverts() public {
        uint256 id = _open();
        vm.prank(seller);
        escrow.markDelivered(id);
        vm.warp(block.timestamp + INSPECTION + 1);

        vm.prank(buyer);
        vm.expectRevert(Escrow.TooLate.selector);
        escrow.dispute(id);
    }

    function test_strangers_cannotMoveFunds() public {
        uint256 id = _open();
        address stranger = makeAddr("stranger");

        vm.startPrank(stranger);
        vm.expectRevert(Escrow.NotAllowed.selector);
        escrow.release(id);
        vm.expectRevert(Escrow.NotAllowed.selector);
        escrow.refund(id);
        vm.expectRevert(Escrow.NotAllowed.selector);
        escrow.resolve(id, 0);
        vm.stopPrank();

        vm.prank(seller);
        vm.expectRevert(Escrow.NotAllowed.selector);
        escrow.release(id);
    }

    function test_feeOnTransferToken_rejected() public {
        FeeToken fee = new FeeToken();
        fee.mint(buyer, AMOUNT);
        vm.startPrank(buyer);
        fee.approve(address(escrow), AMOUNT);
        vm.expectRevert(Escrow.UnsupportedToken.selector);
        escrow.open(seller, IERC20(address(fee)), AMOUNT, uint64(block.timestamp + 1 days));
        vm.stopPrank();
    }

    function testFuzz_resolve_splitsExactly(uint256 toSeller) public {
        toSeller = bound(toSeller, 0, AMOUNT);
        uint256 id = _open();
        vm.prank(seller);
        escrow.markDelivered(id);
        vm.prank(buyer);
        escrow.dispute(id);

        vm.prank(arbiter);
        escrow.resolve(id, toSeller);

        assertEq(usd.balanceOf(seller), toSeller);
        assertEq(usd.balanceOf(buyer), 1_000e6 - toSeller);
        assertEq(usd.balanceOf(address(escrow)), 0);
    }
}
