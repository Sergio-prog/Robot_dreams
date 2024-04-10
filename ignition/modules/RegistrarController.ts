import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, upgrades } from "hardhat";

const defaultDomainPrice = 1n * 10n ** 18n; // 50_000_000_000_000_000 // 0.05 Ethers

(async () => {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const registrar = await ethers.getContractFactory("RegistrarController");
  const contract = await upgrades.deployProxy(registrar, [deployer.address, defaultDomainPrice]);
  console.log("RegistrarController deployed to:", await contract.getAddress());
})();