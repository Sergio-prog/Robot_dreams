import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import RegistrarControllerProxyModule from "./RegistrarController"

const RegistrarControllerUpgradeModule = buildModule("RegistrarControllerUpgradeModule", (m) => {
  const proxyAdminOwner = m.getAccount(0);

  const { proxyAdmin, proxy } = m.useModule(RegistrarControllerProxyModule);

  const RegistrarControllerV2 = m.contract("RegistrarController");

  m.call(proxyAdmin, "upgradeAndCall", [proxy, RegistrarControllerV2, "0x"], {
    from: proxyAdminOwner,
  });

  return { proxyAdmin, proxy };
});

export default RegistrarControllerUpgradeModule;