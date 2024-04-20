import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { ethers, upgrades } from "hardhat";

const defaultDomainPrice = 1n * 10n ** 18n; // 50_000_000_000_000_000 // 0.05 Ethers

const RegistrarControllerProxyModule = buildModule("RegistrarControllerProxyModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);

  const registrar = m.contract("RegistrarController", [proxyAdminOwner, defaultDomainPrice], { from: proxyAdminOwner });

  const proxy = m.contract("TransparentUpgradeableProxy", [
    registrar,
    proxyAdminOwner,
    "0x",
  ]);

  const proxyAdminAddress = m.readEventArgument(
    proxy,
    "AdminChanged",
    "newAdmin"
  );

  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress);

  return { proxyAdmin, proxy };
});

export default RegistrarControllerProxyModule;

(async () => {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);

  const registrar = await ethers.getContractFactory("RegistrarController");
  const contract = await upgrades.deployProxy(registrar, [deployer.address, defaultDomainPrice]);
  console.log("RegistrarController deployed to:", await contract.getAddress());
})();
