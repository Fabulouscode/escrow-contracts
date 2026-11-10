// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";
import {DemoUSD} from "./Demo.s.sol";

/// Fresh Anvil: account 0 is the arbiter, 1 the buyer, 2 the seller.
/// Escrow lands at 0x5FbDB2315678afecb367f032d93F642f64180aa3, dUSD at 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512.
contract DeployLocal is Script {
    string constant MNEMONIC = "test test test test test test test test test test test junk";

    function run() external {
        uint256 arbiterKey = vm.deriveKey(MNEMONIC, 0);
        address arbiter = vm.addr(arbiterKey);

        vm.startBroadcast(arbiterKey);
        Escrow escrow = new Escrow(arbiter, 2 minutes);
        DemoUSD usd = new DemoUSD();
        usd.mint(vm.addr(vm.deriveKey(MNEMONIC, 1)), 1_000e6);
        usd.mint(vm.addr(vm.deriveKey(MNEMONIC, 2)), 1_000e6);
        vm.stopBroadcast();

        console.log("Escrow:", address(escrow));
        console.log("dUSD:  ", address(usd));
    }
}
