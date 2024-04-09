import { ethers, upgrades } from "hardhat";

(async () => {
  const registrarV2 = await ethers.getContractFactory("RegistrarController");
  const address = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" // Replace 
  
  const upgradedToContractV2 = await upgrades.upgradeProxy(address, registrarV2);
  console.log("RegistrarControllerV2 upgraded\n");

  console.log("RegistrarControllerV2 address:", await upgradedToContractV2.getAddress());
})();