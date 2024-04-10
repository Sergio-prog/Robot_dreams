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
      const ONE_ETHER = 1n * 10n ** 18n;

      // Contracts are deployed using the first signer/account by default
      const [owner, otherAccount, otherAccount2] = await hre.ethers.getSigners();

      const RegistrarController = await hre.ethers.getContractFactory("RegistrarController");
      const registrar = await upgrades.deployProxy(RegistrarController, [owner.address, ONE_ETHER], { initializer: 'initialize', kind: 'transparent' });

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

      return { registrar: (registrar as unknown as RegistrarController), owner, otherAccount, otherAccount2, domainPrice: ONE_ETHER };
    }

    describe("Deployment", function() {
        it("Owner should be correct", async function() {
            const { registrar, owner } = await loadFixture(deployFixture);

            expect(await registrar.owner()).to.equal(owner.address);
        });

        it("Domain price should be default", async function() {
            const { registrar, domainPrice } = await loadFixture(deployFixture);

            expect(await registrar.domainPrice()).to.equal(domainPrice);
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

            let tx = await registrar.registerDomain(domainName, { value: domainPrice });

            // This line is added because polling is used to receive events, and the polling interval is 4 seconds
            await new Promise(res => setTimeout(() => res(null), 4001));

            expect(tx).not.to.be.reverted;
            expect(tx).to.emit(registrar, "DomainPurchase");

            expect(await registrar.getDomainController(domainName)).to.equal(owner);
            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
        });

        it("Should revert if value of ethers smaller than expected in register domain", async function() {
            const { registrar } = await loadFixture(deployFixture);
            const domainName = "com";
            await expect(registrar.registerDomain(domainName, { value: 1 })).to.be.revertedWith(
                "Ether value is lower than price."
            );

            // Without value
            await expect(registrar.registerDomain(domainName)).to.be.revertedWith(
                "Ether value is lower than price."
            );
        });

        it("Should revert if domain is already taken", async function() {
            const { registrar, domainPrice, otherAccount } = await loadFixture(deployFixture);
            const domainName = "org";

            await registrar.connect(otherAccount).registerDomain(domainName, { value: domainPrice });

            await expect(registrar.registerDomain(domainName, { value: domainPrice })).to.be.revertedWith(
                "Domain has been purchased by someone before."
            );
            await new Promise(res => setTimeout(() => res(null), 5001));
        });

        it("Should add rewards for top domain owners", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2, owner } = await loadFixture(deployFixture);
            
            await registrar.connect(otherAccount).registerDomain("org", { value: domainPrice });
            const registerTx2 = await registrar.connect(otherAccount2).registerDomain("test.org", { value: domainPrice });

            await expect(registerTx2).to.changeEtherBalances(
                [otherAccount2],
                [-domainPrice]
            );
            
            const tx1 = await registrar.domainRewards(otherAccount);
            const tx2 = await registrar.domainRewards(owner);

            expect(tx1).to.equal(domainPrice);
            expect(tx2).to.equal(domainPrice);
        });

        it("Should add rewards for top domain owners (3 levels)", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2, owner } = await loadFixture(deployFixture);
            
            await registrar.connect(otherAccount).registerDomain("io", { value: domainPrice });
            await registrar.connect(otherAccount).registerDomain("test.io", { value: domainPrice });

            const registerTx2 = await registrar.connect(otherAccount2).registerDomain("www.test.io", { value: domainPrice });

            await expect(registerTx2).to.changeEtherBalances(
                [otherAccount2],
                [-domainPrice]
            );
            
            expect(await registrar.domainRewards(otherAccount)).to.equal(domainPrice * 2n);
            expect(await registrar.domainRewards(owner)).to.equal(domainPrice);
        });

        it("Should revert if trying to register wrong top level domain.", async function() {
            const { registrar, domainPrice, otherAccount, otherAccount2 } = await loadFixture(deployFixture);

            await registrar.connect(otherAccount).registerDomain("io", { value: domainPrice });
            

            await expect(registrar.connect(otherAccount2).registerDomain("www.test.io", { value: domainPrice })).to.be.revertedWith(
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

            await registrar.connect(otherAccount).registerDomain(domainName, { value: domainPrice });
            await new Promise(res => setTimeout(() => res(null), 5001));

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
            await expect(registrar.withdrawAllEther(owner.address)).to.changeEtherBalances(
                [owner, registrar],
                [domainPrice, -domainPrice]
            );
        });

        it("Withdraw all rewards to address (3 levels)", async function() {
            const { registrar, owner, otherAccount, otherAccount2, domainPrice } = await loadFixture(deployFixture);

            await registrar.connect(otherAccount).registerDomain("io", { value: domainPrice });
            await registrar.connect(otherAccount).registerDomain("test.io", { value: domainPrice });

            await expect(await registrar.connect(otherAccount2).registerDomain("www.test.io", { value: domainPrice })).to.changeEtherBalances(
                [otherAccount2, registrar],
                [-domainPrice, domainPrice]
            );

            await new Promise(res => setTimeout(() => res(null), 5001));

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice * 3n);
            await expect(registrar.withdrawAllEther(owner.address)).to.changeEtherBalances(
                [owner, registrar],
                [domainPrice, -domainPrice]
            );

            await expect(registrar.withdrawAllEther(otherAccount.address)).to.changeEtherBalances(
                [otherAccount, registrar],
                [domainPrice * 2n, -domainPrice * 2n]
            );

        });
    })


    after(function() {
        console.log(`Total domains purchased: ${domainPurchased}`);
        console.log(`All domains list: ${stringify(allDomainsSorted)}`);
        console.log(`All domains list by user: ${stringify(allDomainsUserSorted)}`);
    })
});
