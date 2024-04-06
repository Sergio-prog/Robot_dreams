import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const defaultDomainPrice = 1n * 10n ** 18n; // 50_000_000_000_000_000 // 0.05 Ethers

const RegistrarControllerModule = buildModule("RegistrarControllerModule", (m) => {
  // const unlockTime = m.getParameter("unlockTime", JAN_1ST_2030);
  const account1 = m.getAccount(0);

  const registrar = m.contract("RegistrarController", [account1, defaultDomainPrice], { from: account1 });

  return { registrar };
});

export default RegistrarControllerModule;
