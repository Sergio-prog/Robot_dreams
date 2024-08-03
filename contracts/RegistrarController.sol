// SPDX-License-Identifier: UNLICENSED

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

pragma solidity 0.8.24;

/**
 * @title A simple domain registry
 * @author Sergey Nesterov (Sergio-Prog)
 */
contract RegistrarController is Initializable, ContextUpgradeable, OwnableUpgradeable {
    // keccak256(abi.encode(uint256(keccak256("RegistrarController.main")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3eb6e6dee6a7a8f6972392e1f1659b26c1c7f421b78f4d3e4fc217943767e300;

    /// @custom:storage-location erc7201:RegistrarController.main
    struct MainStorage {
        /// @notice Current price of domain
        uint domainPrice;

        /// @dev Map with domainName -> owner
        mapping (string => address) domainRecords;
    }

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

    function _getMainStorage() private pure returns (MainStorage storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }

    /**
     * Contract init
     * @param _owner Owner address of contract
     * @param _domainPrice Init domain price
     */
    // constructor(address _owner, uint _domainPrice) Ownable(_owner) {
    function initialize(address _owner, uint _domainPrice) initializer public {
        __Ownable_init(_owner);
        _getMainStorage().domainPrice = _domainPrice;
        emit DomainPriceChanged(_domainPrice);
    }

    /**
     * Return controller of domain
     * @param domainName Name of domain to check
     */
    function getDomainController(string memory domainName) external view returns (address) {
        return _getMainStorage().domainRecords[domainName];
    }
    
    function domainPrice() external view returns (uint256) {
        return _getMainStorage().domainPrice;
    }

    /**
     * Register new domain
     * @param domainName Name of domain to register
     */
    function registerDomain(string memory domainName) payable external {
        MainStorage storage $ = _getMainStorage();

        require(msg.value >= $.domainPrice, "Ether value is lower than price.");
        require($.domainRecords[domainName] == address(0), "Domain has been purchased by someone before.");

        $.domainRecords[domainName] = msg.sender;
        emit DomainPurchase(msg.sender, domainName, block.timestamp);
    }

     /**
     * Set new price for domains (Only for owner)
     * @param newPrice New price for domains
     */
    function setDomainPrice(uint newPrice) external onlyOwner {
        MainStorage storage $ = _getMainStorage();
        $.domainPrice = newPrice;
        emit DomainPriceChanged($.domainPrice);
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
