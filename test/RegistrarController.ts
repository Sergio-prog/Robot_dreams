import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre, {upgrades} from "hardhat";
import { RegistrarController } from "../typechain-types/contracts/RegistrarController";


type Domain = {
    name: string;
    timestamp: number;
    owner: string
}

let domainPurchased = 0;
let allDomains: Domain[] = [];
let allDomainsSorted: Domain[] = [];
let allDomainsUser: Record<string, Array<Domain>> = {};
let allDomainsUserSorted: Record<string, Array<Domain>> = {};

const stringify = (value: any) => JSON.stringify(value, undefined, 2);

describe("RegistrarController", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
      const usdDecimals = 8;
      const domainPrice = BigInt(50 * 10 ** usdDecimals);

      // Contracts are deployed using the first signer/account by default
      const [owner, otherAccount, otherAccount2] = await hre.ethers.getSigners();

      const TestUSDT = await hre.ethers.getContractFactory("TestUSDT");
      const usdt = await TestUSDT.deploy();

      const TestOracle = await hre.ethers.getContractFactory("TestOracle");
      const oracle = await TestOracle.deploy(8);
      await oracle.setLatestRoundData(3000n * 10n ** await oracle.decimals());

      const RegistrarController = await hre.ethers.getContractFactory("RegistrarController");
      const registrar = await upgrades.deployProxy(RegistrarController, [owner.address, domainPrice, usdDecimals, await oracle.getAddress(), await usdt.getAddress()],
       { initializer: 'initialize', kind: 'transparent' });

      const ethDomainPrice = await registrar.ethDomainPrice();

      // Listening events
      registrar.on(registrar.getEvent("DomainPurchase"), (owner, domainName, timestamp) => {
        const domain: Domain = { name: domainName, owner: owner, timestamp: Number(timestamp) };
        domainPurchased++;

        allDomains.push(domain);
        allDomainsSorted = allDomains.sort((prev, curr) => Number(prev.timestamp - curr.timestamp));

        if (!Array.isArray(allDomainsUser[owner])) {
            allDomainsUser[owner] = [];
        }
        allDomainsUser[owner].push(domain);

        for (const owner in allDomainsUser) {
            allDomainsUserSorted[owner] = allDomainsUser[owner].sort((prev, curr) => Number(prev.timestamp - curr.timestamp));
        }
      })

      // This function needs to convert the domain value at registrar contract to USDT value, as the decimals are may be different.
      const usdToUsdt = async (usdValue: bigint) => {
        return usdValue * 10n ** (await usdt.decimals() - BigInt(usdDecimals));
      };

      const convertedUsdt = await usdToUsdt(domainPrice);

      return { registrar: (registrar as unknown as RegistrarController), owner, otherAccount, otherAccount2,
         domainPrice: ethDomainPrice as bigint, usdDomainPrice: domainPrice, usdt, oracle, usdToUsdt, convertedUsdt };
    }

    describe("Deployment", function() {
        it("Owner should be correct", async function() {
            const { registrar, owner } = await loadFixture(deployFixture);

            expect(await registrar.owner()).to.equal(owner.address);
        });

        it("Domain price should be default", async function() {
            const { registrar, usdDomainPrice } = await loadFixture(deployFixture);

            expect(await registrar.domainPrice()).to.equal(usdDomainPrice);
        })

        it("ETH Domain price should be default", async function() {
            const { registrar, domainPrice } = await loadFixture(deployFixture);

            expect(await registrar.ethDomainPrice()).to.equal(domainPrice);
        })

        it("ETH Domain price should be correct", async function() {
            const { registrar, usdDomainPrice } = await loadFixture(deployFixture);

            expect(await registrar.ethDomainPrice()).to.equal(usdDomainPrice / 3000n * 10n ** 10n);
        })
    });

    describe("Domains", function() {
        it("Should return null address if domain controller not found", async function() {
            const { registrar } = await loadFixture(deployFixture);
            const randomDomain = "com";

            expect(await registrar.getDomainController(randomDomain)).to.equal(hre.ethers.ZeroAddress);
        });

        it("Register new domain", async function() {
            const { registrar, domainPrice, owner } = await loadFixture(deployFixture);
            const domainName = "com";

            let tx = await registrar.registerDomain(domainName, false, { value: domainPrice });

            // This line is added because polling is used to receive events, and the polling interval is 4 seconds
            await new Promise(res => setTimeout(() => res(null), 4001));

            expect(tx).not.to.be.reverted;
            expect(tx).to.emit(registrar, "DomainPurchase");

            expect(await registrar.getDomainController(domainName)).to.equal(owner);
            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
        });

        it("Register new domain by USDT", async function() {
            const { registrar, owner, usdt, usdDomainPrice, convertedUsdt } = await loadFixture(deployFixture);
            const domainName = "ua";
            
            const decimals = await usdt.decimals();
            await usdt.approve(await registrar.getAddress(), usdDomainPrice * 10n ** decimals)

            let tx = await registrar.registerDomain(domainName, true);

            expect(tx).not.to.be.reverted;
            expect(tx).to.emit(registrar, "DomainPurchase");


            expect(await registrar.getDomainController(domainName)).to.equal(owner);
            expect(await usdt.balanceOf(await registrar.getAddress())).to.equal(convertedUsdt);
        });

        it("Should revert if value of ethers smaller than expected in register domain", async function() {
            const { registrar } = await loadFixture(deployFixture);
            const domainName = "online";
            await expect(registrar.registerDomain(domainName, false, { value: 1 })).to.be.revertedWith(
                "Ether value is lower than price."
            );

            // Without value
            await expect(registrar.registerDomain(domainName, false)).to.be.revertedWith(
                "Ether value is lower than price."
            );
        });

        it("Should revert if USDT value is smaller than expected in register domain", async function() {
            const { registrar, usdt, otherAccount, owner } = await loadFixture(deployFixture);
            const domainName = "eth";

            await usdt.approve(await registrar.getAddress(), 1);
            await expect(registrar.registerDomain(domainName, true)).to.be.revertedWithCustomError(
                usdt, "ERC20InsufficientAllowance"
            );
            
            // With zero approve
            await usdt.approve(await registrar.getAddress(), 0);
            await expect(registrar.registerDomain(domainName, true)).to.be.revertedWithCustomError(
                usdt, "ERC20InsufficientAllowance"
            );
            
            // With zero USDT balance
            const balance = await usdt.balanceOf(await owner.getAddress());
            await usdt.transfer(otherAccount, balance);

            await expect(registrar.registerDomain(domainName, true)).to.be.revertedWith(
                "Your balance is too low."
            );
        });

        it("Should revert if domain is already taken", async function() {
            const { registrar, domainPrice, otherAccount } = await loadFixture(deployFixture);
            const domainName = "org";

            await registrar.connect(otherAccount).registerDomain(domainName, false, { value: domainPrice });

            await expect(registrar.registerDomain(domainName, false, { value: domainPrice })).to.be.revertedWith(
                "Domain has been purchased by someone before."
            );
            await new Promise(res => setTimeout(() => res(null), 4001));
        });

        it("Should add rewards for top domain owners", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2, owner } = await loadFixture(deployFixture);
            
            await registrar.connect(otherAccount).registerDomain("org", false, { value: domainPrice });
            const registerTx2 = await registrar.connect(otherAccount2).registerDomain("test.org", false, { value: domainPrice });

            await expect(registerTx2).to.changeEtherBalances(
                [otherAccount2],
                [-domainPrice]
            );

            const tx1 = await registrar.domainRewards(otherAccount);
            const tx2 = await registrar.domainRewards(owner);
            
            expect(tx1[0]).to.equal(domainPrice);
            expect(tx2[0]).to.equal(domainPrice);
        });

        it("Should add rewards for top domain owners (3 levels)", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2, owner } = await loadFixture(deployFixture);
            
            await registrar.connect(otherAccount).registerDomain("io", false, { value: domainPrice });
            await registrar.connect(otherAccount).registerDomain("test.io", false, { value: domainPrice });

            const registerTx2 = await registrar.connect(otherAccount2).registerDomain("www.test.io", false, { value: domainPrice });
            
            await expect(registerTx2).to.changeEtherBalances(
                [otherAccount2],
                [-domainPrice]
            );
            
            expect((await registrar.domainRewards(otherAccount))[0]).to.equal(domainPrice * 2n);
            expect((await registrar.domainRewards(owner))[0]).to.equal(domainPrice);
        });

        it("Should add mixed rewards (USDT, ETH) for top domain owners (3 levels)", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2, owner, usdt, convertedUsdt } = await loadFixture(deployFixture);
            
            await usdt.transfer(otherAccount, convertedUsdt * 2n);
            await usdt.transfer(otherAccount2, convertedUsdt);
            
            await usdt.connect(otherAccount).approve(await registrar.getAddress(), convertedUsdt * 2n);
            await registrar.connect(otherAccount).registerDomain("io", true);

            await registrar.connect(otherAccount).registerDomain("test.io", false, { value: domainPrice });

            await usdt.connect(otherAccount2).approve(await registrar.getAddress(), convertedUsdt);
            const registerTx2 = await registrar.connect(otherAccount2).registerDomain("www.test.io", true);

            await expect(registerTx2).to.changeTokenBalances(
                usdt,
                [otherAccount2, registrar],
                [-convertedUsdt, convertedUsdt]
            );
            
            expect((await registrar.domainRewards(otherAccount))[0]).to.equal(domainPrice);
            expect((await registrar.domainRewards(otherAccount))[1]).to.equal(convertedUsdt);
            expect((await registrar.domainRewards(owner))[1]).to.equal(convertedUsdt);      
        });

        it("Should revert if trying to register wrong top level domain.", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2 } = await loadFixture(deployFixture);

            await registrar.connect(otherAccount).registerDomain("io", false, { value: domainPrice });
            

            await expect(registrar.connect(otherAccount2).registerDomain("www.test.io", false, { value: domainPrice })).to.be.revertedWith(
                "Not all domain levels has been registred."
            );
        })
    });

    describe("Price", function() {
        it("Should revert if msg.sender is not owner on price change", async function() {
            const { registrar, otherAccount } = await loadFixture(deployFixture);
            const newPrice = 2n * 10n ** 18n;

            await expect(registrar.connect(otherAccount).setDomainPrice(newPrice)).to.be.reverted;
        });

        it("Set new domain price", async function() {
            const { registrar } = await loadFixture(deployFixture);
            const newPrice = 2n * 10n ** 18n;

            await expect(registrar.setDomainPrice(newPrice)).not.to.be.reverted;
            expect(await registrar.domainPrice()).to.equal(newPrice);
        });
    });

    describe("Withdraw", function() {
        it("Withdraw all ethers to address", async function() {
            const { registrar, owner, otherAccount, domainPrice } = await loadFixture(deployFixture);
            const domainName = "io";

            await registrar.connect(otherAccount).registerDomain(domainName, false, { value: domainPrice });
            await new Promise(res => setTimeout(() => res(null), 5001));

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
            await expect(registrar.withdrawAllRewards()).to.changeEtherBalances(
                [owner, registrar],
                [domainPrice, -domainPrice]
            );
        });

        it("Withdraw all rewards to address (3 levels)", async function() {
            const { registrar, owner, otherAccount, otherAccount2, domainPrice } = await loadFixture(deployFixture);

            await registrar.connect(otherAccount).registerDomain("io", false, { value: domainPrice });
            await registrar.connect(otherAccount).registerDomain("test.io", false, { value: domainPrice });

            await expect(await registrar.connect(otherAccount2).registerDomain("www.test.io", false, { value: domainPrice })).to.changeEtherBalances(
                [otherAccount2, registrar],
                [-domainPrice, domainPrice]
            );

            await new Promise(res => setTimeout(() => res(null), 5001));

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice * 3n);
            await expect(registrar.withdrawAllRewards()).to.changeEtherBalances(
                [owner, registrar],
                [domainPrice, -domainPrice]
            );

            await expect(registrar.connect(otherAccount).withdrawAllRewards()).to.changeEtherBalances(
                [otherAccount, registrar],
                [domainPrice * 2n, -domainPrice * 2n]
            );

        });

        it("Withdraw all mixed rewards (USDT, ETH) to address (3 levels)", async function() {
            const { registrar, usdt, owner, otherAccount,
                 otherAccount2, domainPrice, convertedUsdt } = await loadFixture(deployFixture);
            
            await usdt.transfer(otherAccount, convertedUsdt * 2n);
            await usdt.transfer(otherAccount2, convertedUsdt * 3n);

            await usdt.connect(otherAccount).approve(await registrar.getAddress(), convertedUsdt * 2n);
            await registrar.connect(otherAccount).registerDomain("io", true);
            await registrar.connect(otherAccount).registerDomain("test.io", false, { value: domainPrice });
            
            await registrar.connect(otherAccount).registerDomain("airdrop.test.io", true);
            
            await usdt.connect(otherAccount2).approve(await registrar.getAddress(), convertedUsdt * 2n);
            await expect(await registrar.connect(otherAccount2).registerDomain("www.test.io", true)).to.changeTokenBalances(
                usdt,
                [otherAccount2, registrar],
                [-convertedUsdt, convertedUsdt]
            );

            await new Promise(res => setTimeout(() => res(null), 4001));

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
            expect(await usdt.balanceOf(await registrar.getAddress())).to.equal(convertedUsdt * 3n);
            await expect(registrar.connect(owner).withdrawAllRewards()).to.changeTokenBalances(
                usdt,
                [owner, registrar],
                [convertedUsdt, -convertedUsdt]
            );

            const rewards = await registrar.connect(otherAccount).domainRewards(otherAccount.address);
            await expect(rewards[0]).to.equal(domainPrice);
            await expect(rewards[1]).to.equal(convertedUsdt * 2n);
            
            const withdrawTx = await registrar.connect(otherAccount).withdrawAllRewards();

            await expect(withdrawTx).to.changeEtherBalances(
                [otherAccount, registrar],
                [domainPrice, -domainPrice]
            );

            await expect(withdrawTx).to.changeTokenBalances(
                usdt,
                [otherAccount, registrar],
                [convertedUsdt * 2n, -convertedUsdt * 2n]
            )

        });
    })


    after(function() {
        console.log(`Total domains purchased: ${domainPurchased}`);
        console.log(`All domains list: ${stringify(allDomainsSorted)}`);
        console.log(`All domains list by user: ${stringify(allDomainsUserSorted)}`);
    })
});
