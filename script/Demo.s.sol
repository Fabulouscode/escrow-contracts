// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Escrow} from "../src/Escrow.sol";

contract DemoUSD is ERC20 {
    constructor() ERC20("Demo USD", "dUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// Two deals on a local Anvil chain: one happy path, one dispute.
/// anvil &  forge script script/Demo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
contract Demo is Script {
    string constant MNEMONIC = "test test test test test test test test test test test junk";

    uint256 buyerKey;
    uint256 sellerKey;
    uint256 arbiterKey;
    address buyer;
    address seller;
    address arbiter;

    Escrow escrow;
    DemoUSD usd;

    function run() external {
        arbiterKey = vm.deriveKey(MNEMONIC, 0);
        buyerKey = vm.deriveKey(MNEMONIC, 1);
        sellerKey = vm.deriveKey(MNEMONIC, 2);
        arbiter = vm.addr(arbiterKey);
        buyer = vm.addr(buyerKey);
        seller = vm.addr(sellerKey);

        vm.startBroadcast(arbiterKey);
        escrow = new Escrow(arbiter, 3 days);
        usd = new DemoUSD();
        usd.mint(buyer, 1_000e6);
        vm.stopBroadcast();

        console.log("Escrow contract:", address(escrow));
        console.log("Buyer starts with", _fmt(usd.balanceOf(buyer)));

        console.log("");
        console.log("DEAL 1: buyer pays 500 for a laptop");
        uint256 one = _open(500e6);
        _as(sellerKey);
        escrow.markDelivered(one);
        vm.stopBroadcast();
        console.log("  seller marks it delivered");
        _as(buyerKey);
        escrow.release(one);
        vm.stopBroadcast();
        console.log("  buyer is happy and releases");
        _as(sellerKey);
        escrow.withdraw(usd);
        vm.stopBroadcast();
        console.log("  seller withdraws ->", _fmt(usd.balanceOf(seller)));

        console.log("");
        console.log("DEAL 2: buyer pays 300 for phones, 2 arrive broken");
        uint256 two = _open(300e6);
        _as(sellerKey);
        escrow.markDelivered(two);
        vm.stopBroadcast();
        _as(buyerKey);
        escrow.dispute(two);
        vm.stopBroadcast();
        console.log("  buyer disputes inside the inspection window");
        _as(arbiterKey);
        escrow.resolve(two, 180e6);
        vm.stopBroadcast();
        console.log("  arbiter: 180 to seller, 120 back to buyer");
        _as(sellerKey);
        escrow.withdraw(usd);
        vm.stopBroadcast();
        _as(buyerKey);
        escrow.withdraw(usd);
        vm.stopBroadcast();

        console.log("");
        console.log("FINAL");
        console.log("  buyer  :", _fmt(usd.balanceOf(buyer)));
        console.log("  seller :", _fmt(usd.balanceOf(seller)));
        console.log("  escrow :", _fmt(usd.balanceOf(address(escrow))));
    }

    function _open(uint256 amount) internal returns (uint256 id) {
        _as(buyerKey);
        usd.approve(address(escrow), amount);
        id = escrow.open(seller, usd, amount, uint64(block.timestamp + 7 days));
        vm.stopBroadcast();
        console.log("  deal", id, "opened, escrow now holds", _fmt(usd.balanceOf(address(escrow))));
    }

    function _as(uint256 key) internal {
        vm.startBroadcast(key);
    }

    function _fmt(uint256 amount) internal pure returns (string memory) {
        return string.concat(vm.toString(amount / 1e6), " dUSD");
    }
}
