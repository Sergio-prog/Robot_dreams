import {
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("RegistrarController", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
      const ONE_ETHER = 1n * 10n ** 18n;

      // Contracts are deployed using the first signer/account by default
      const [owner, otherAccount] = await hre.ethers.getSigners();

      const RegistrarController = await hre.ethers.getContractFactory("RegistrarController");
      const registrar = await RegistrarController.deploy(owner.address, ONE_ETHER);

      return { registrar, owner, otherAccount, domainPrice: ONE_ETHER };
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
        // it("Should throw error if domain controller not found", async function() {
        //     const { registrar } = await loadFixture(deployFixture);
        //     const randomDomain = "com";

        //     await expect(registrar.getDomainController(randomDomain)).to.be.revertedWith(
        //         "Domain controller not found."
        //     )
        // });

        it("Should return null address if domain controller not found", async function() {
            const { registrar } = await loadFixture(deployFixture);
            const randomDomain = "com";

            expect(await registrar.getDomainController(randomDomain)).to.equal(hre.ethers.ZeroAddress);
        });

        it("Register new domain", async function() {
            const { registrar, domainPrice, owner } = await loadFixture(deployFixture);
            const domainName = "com";
            // console.log(domainPrice, typeof domainPrice);


            await registrar.registerDomain(domainName, { value: domainPrice });

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
            const domainName = "com";

            await registrar.connect(otherAccount).registerDomain(domainName, { value: domainPrice });

            await expect(registrar.registerDomain(domainName, { value: domainPrice })).to.be.revertedWith(
                "Domain has been purchased by someone before."
            );
        });
    });

    describe("Price", function() {
        it("Should revert if msg.sender is not owner on price change", async function() {
            const { registrar, otherAccount } = await loadFixture(deployFixture);
            const newPrice = 2n * 10n ** 18n;

            await expect(registrar.connect(otherAccount).setDomainPrice(newPrice)).to.be.reverted;
        });

        it("Set new domain price", async function() {
            const { registrar, otherAccount } = await loadFixture(deployFixture);
            const newPrice = 2n * 10n ** 18n;

            await expect(registrar.setDomainPrice(newPrice)).not.to.be.reverted;
            expect(await registrar.domainPrice()).to.equal(newPrice);
        });

        // it("Get domain price");
    });

    describe("Withdraw", function() {
        it("Withdraw all ethers to address", async function() {
            const { registrar, owner, otherAccount, domainPrice } = await loadFixture(deployFixture);
            const domainName = "com";

            await registrar.connect(otherAccount).registerDomain(domainName, { value: domainPrice });

            expect(await hre.ethers.provider.getBalance(await registrar.getAddress())).to.equal(domainPrice);
            await expect(registrar.withdrawAllEther(owner.address)).to.changeEtherBalances(
                [owner, registrar],
                [domainPrice, -domainPrice]
            );
        });
    })
});
