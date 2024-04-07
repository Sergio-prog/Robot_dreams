import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

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
