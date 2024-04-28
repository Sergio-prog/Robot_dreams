import { ethers, upgrades } from "hardhat";

(async () => {
  const registrarV2 = await ethers.getContractFactory("RegistrarController");
  const address = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" // Replace this. Proxy storage contract address  
  
  const upgradedToContractV2 = await upgrades.upgradeProxy(address, registrarV2);
  console.log("RegistrarControllerV2 upgraded\n");

  console.log("RegistrarControllerV2 address:", await upgradedToContractV2.getAddress());
})();