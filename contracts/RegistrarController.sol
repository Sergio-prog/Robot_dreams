// SPDX-License-Identifier: UNLICENSED

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {strings} from "./libraries/strings.sol";

pragma solidity 0.8.24;

/**
 * @title A simple domain registry
 * @author Sergey Nesterov (Sergio-Prog)
 */
contract RegistrarController is Initializable, ContextUpgradeable, OwnableUpgradeable {
    using strings for *;

    /// @notice Current price of domain
    uint public domainPrice;

    /// @dev Map with domainName -> owner
    mapping (string => address) private domainRecords;
    
    /// @notice Rewards for register subdomain for domain owner
    mapping (address => uint) public domainRewards;

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
    function initialize(address _owner, uint _domainPrice) initializer public {
        domainPrice = _domainPrice;
        __Ownable_init(_owner);
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

        strings.slice memory s = domainName.toSlice();
        strings.slice memory delim = ".".toSlice();
        uint parts = s.count(delim);

        uint restValue = domainPrice;

        string memory localDomainName = "";
        
        for(uint i = 0; i < parts; i++) {
            if (i > 0) {
                localDomainName = string.concat(s.rsplit(delim).toString(), ".", localDomainName); // Join all domain parts
            } else {
                localDomainName = s.rsplit(delim).toString(); // or take last part of domain, if it first iteration
            }
            
            
            address domainOwner = domainRecords[localDomainName];
            require(domainOwner != address(0), "Not all domain levels has been registred.");

            if (domainOwner != address(0)) {
                uint reward = domainPrice / parts;
                domainRewards[domainOwner] += reward;

                restValue -= reward;
            }
        }

        domainRewards[owner()] += restValue;

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
     * Withdraws all ethers rewards from contract to owner
     * @param to Rewards receiver address
     */
    function withdrawAllEther(address payable to) external onlyOwner {
        uint balance = domainRewards[to];
        require(balance > 0, "Your rewards must be greater than 0.");

        domainRewards[to] = 0;

        (bool sent,) = to.call{value: balance}("");
        require(sent, "Failed to send Ether rewards.");

        emit EtherWithdraw(to, balance);
    }
}
