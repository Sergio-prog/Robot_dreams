import { ethers, upgrades } from "hardhat";

const defaultDomainPrice = 1n * 10n ** 18n; // 50_000_000_000_000_000 // 0.05 Ethers

(async () => {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const registrar = await ethers.getContractFactory("RegistrarController");
<<<<<<< HEAD
  const contract = await upgrades.deployProxy(registrar, [deployer.address, defaultDomainPrice]);
=======
  const contract = await upgrades.deployProxy(registrar, [deployer.address, defaultDomainPrice], {initializer: 'initialize'});
>>>>>>> a768cfc8d3d7677e30442337c3e56b14615ef348
  console.log("RegistrarController deployed to:", await contract.getAddress());
})();