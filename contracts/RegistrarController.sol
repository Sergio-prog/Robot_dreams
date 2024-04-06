// SPDX-License-Identifier: UNLICENSED

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity 0.8.24;

/**
 * @title A simple domain registry
 * @author Sergey Nesterov (Sergio-Prog)
 */
contract RegistrarController is Ownable {
    /// @notice Current price of domain
    uint public domainPrice;

    /// @dev Map with domainName -> owner
    mapping (string => address) private domainRecords;

    /**
     * Domain Purchase event
     * @param owner Address of purchased domain
     * @param domainName Purchased domain name
     * @param timestamp Block timestamp of purchase
     */
    event DomainPurchase(address indexed owner, string domainName, uint indexed timestamp);

    /**
     * Withdraw all ethers from contract event
     * @param to Receiver of Ethers
     * @param value Ethers withdraw amount (in wei)
     */
    event EtherWithdraw(address indexed to, uint indexed value);

    /**
     * The price of the domain has been changed event
     * @param newPrice The new domain price
     */
    event DomainPriceChanged(uint newPrice);

    /**
     * Contract init
     * @param _owner Owner address of contract
     * @param _domainPrice Init domain price
     */
    constructor(address _owner, uint _domainPrice) Ownable(_owner) {
        domainPrice = _domainPrice;
        emit DomainPriceChanged(domainPrice);
    }

    /**
     * Return controller of domain
     * @param domainName Name of domain to check
     */
    function getDomainController(string memory domainName) external view returns (address) {
        return domainRecords[domainName];
    }

    /**
     * Register new domain
     * @param domainName Name of domain to register
     */
    function registerDomain(string memory domainName) payable external {
        require(msg.value >= domainPrice, "Ether value is lower than price.");
        require(domainRecords[domainName] == address(0), "Domain has been purchased by someone before.");

        domainRecords[domainName] = msg.sender;
        emit DomainPurchase(msg.sender, domainName, block.timestamp);
    }

    /**
     * Set new price for domains (Only for owner)
     * @param newPrice New price for domains
     */
    function setDomainPrice(uint newPrice) external onlyOwner {
        domainPrice = newPrice;
        emit DomainPriceChanged(domainPrice);
    }

    /**
     * Withdraws all ethers from contract to owner
     * @param to Receiver address
     */
    function withdrawAllEther(address payable to) external onlyOwner {
        uint balance = address(this).balance;
        (bool sent,) = to.call{value: balance}("");
        require(sent, "Failed to send Ether");

        emit EtherWithdraw(to, balance);
    }
}
