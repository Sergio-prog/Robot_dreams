import { ethers, upgrades } from "hardhat";

(async () => {
  const registrarV2 = await ethers.getContractFactory("RegistrarController");
  const address = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" // Replace this. Proxy storage contract address
  
  const upgradedToContractV2 = await upgrades.upgradeProxy(address, registrarV2);
  console.log("RegistrarControllerV2 upgraded\n");

  console.log("RegistrarControllerV2 address:", await upgradedToContractV2.getAddress());
})();