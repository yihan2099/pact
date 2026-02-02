// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {TaskManager} from "../src/TaskManager.sol";
import {EscrowVault} from "../src/EscrowVault.sol";
import {DisputeResolver} from "../src/DisputeResolver.sol";
import {PorterRegistry} from "../src/PorterRegistry.sol";

contract DeployScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PorterRegistry first (no dependencies)
        PorterRegistry porterRegistry = new PorterRegistry();
        console.log("PorterRegistry deployed at:", address(porterRegistry));

        // 2. Predict TaskManager address using CREATE (nonce-based)
        // After PorterRegistry deployment, deployer nonce is at a known value
        // We need to deploy EscrowVault first, then TaskManager
        // So: nonce+0 = EscrowVault, nonce+1 = TaskManager
        address deployer = vm.addr(deployerPrivateKey);
        uint64 currentNonce = vm.getNonce(deployer);

        // TaskManager will be deployed at nonce+1 (after EscrowVault at nonce+0)
        address predictedTaskManager = vm.computeCreateAddress(deployer, currentNonce + 1);
        console.log("Predicted TaskManager address:", predictedTaskManager);

        // 3. Deploy EscrowVault with predicted TaskManager address
        EscrowVault escrowVault = new EscrowVault(predictedTaskManager);
        console.log("EscrowVault deployed at:", address(escrowVault));

        // 4. Deploy TaskManager (will be at predicted address)
        TaskManager taskManager = new TaskManager(address(escrowVault), address(porterRegistry));
        console.log("TaskManager deployed at:", address(taskManager));

        // Verify prediction was correct
        require(address(taskManager) == predictedTaskManager, "TaskManager address mismatch!");

        // 5. Deploy DisputeResolver
        DisputeResolver disputeResolver =
            new DisputeResolver(address(taskManager), address(porterRegistry));
        console.log("DisputeResolver deployed at:", address(disputeResolver));

        // 6. Configure access control
        taskManager.setDisputeResolver(address(disputeResolver));
        porterRegistry.setTaskManager(address(taskManager));
        porterRegistry.setDisputeResolver(address(disputeResolver));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("PorterRegistry:", address(porterRegistry));
        console.log("EscrowVault:", address(escrowVault));
        console.log("TaskManager:", address(taskManager));
        console.log("DisputeResolver:", address(disputeResolver));
    }
}
