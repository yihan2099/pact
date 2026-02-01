// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {VerificationHub} from "../src/VerificationHub.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PorterRegistry first (no dependencies)
        PorterRegistry porterRegistry = new PorterRegistry();
        console.log("PorterRegistry deployed at:", address(porterRegistry));

        // 2. Deploy EscrowVault with a placeholder TaskManager address
        // We'll need to use a factory or proxy pattern for proper initialization
        // For now, deploy with a placeholder and note this limitation
        address taskManagerPlaceholder = address(0);
        EscrowVault escrowVault = new EscrowVault(taskManagerPlaceholder);
        console.log("EscrowVault deployed at:", address(escrowVault));

        // 3. Deploy TaskManager
        TaskManager taskManager = new TaskManager(address(escrowVault), address(porterRegistry));
        console.log("TaskManager deployed at:", address(taskManager));

        // 4. Deploy VerificationHub
        VerificationHub verificationHub =
            new VerificationHub(address(taskManager), address(porterRegistry));
        console.log("VerificationHub deployed at:", address(verificationHub));

        // Note: In production, you'd need to:
        // 1. Use upgradeable proxies
        // 2. Set the correct TaskManager address in EscrowVault
        // 3. Set up access control for cross-contract calls

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("PorterRegistry:", address(porterRegistry));
        console.log("EscrowVault:", address(escrowVault));
        console.log("TaskManager:", address(taskManager));
        console.log("VerificationHub:", address(verificationHub));
    }
}
