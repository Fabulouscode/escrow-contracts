// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {Escrow} from "../src/Escrow.sol";

contract Deploy is Script {
    function run() external returns (Escrow escrow) {
        address arbiter = vm.envAddress("ARBITER");
        uint64 inspection = uint64(vm.envOr("INSPECTION_SECONDS", uint256(3 days)));

        vm.startBroadcast();
        escrow = new Escrow(arbiter, inspection);
        vm.stopBroadcast();
    }
}
