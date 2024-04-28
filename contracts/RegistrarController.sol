// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import {strings} from "./libraries/strings.sol";

pragma solidity 0.8.24;

/**
 * @title A simple domain registry
 * @author Sergey Nesterov (Sergio-Prog)
 */

contract RegistrarController is Initializable, OwnableUpgradeable {
    using strings for *;

    // keccak256(abi.encode(uint256(keccak256("RegistrarController.main")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant MAIN_STORAGE_LOCATION = 0x3eb6e6dee6a7a8f6972392e1f1659b26c1c7f421b78f4d3e4fc217943767e300;

    /// @custom:storage-location erc7201:RegistrarController.main
    struct MainStorage {
        /// @notice Current price of domain
        uint256 domainPrice;
        /// @dev Map with domainName -> owner
        mapping(string => address) domainRecords;
        /// @notice Rewards for register subdomain for domain owner
        mapping(address => uint) domainRewards;
    }

    /**
     * Domain Purchase event
     * @param owner Address of purchased domain
     * @param domainName Purchased domain name
     * @param timestamp Block timestamp of purchase
     */
    event DomainPurchase(address indexed owner, string domainName, uint256 indexed timestamp);

    /**
     * Withdraw all ethers from contract event
     * @param to Receiver of Ethers
     * @param value Ethers withdraw amount (in wei)
     */
    event EtherWithdraw(address indexed to, uint256 indexed value);

    /**
     * The price of the domain has been changed event
     * @param newPrice The new domain price
     */
    event DomainPriceChanged(uint256 newPrice);

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
    function initialize(address _owner, uint256 _domainPrice) public initializer {
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

    /// Current domain price
    function domainPrice() external view returns (uint256) {
        return _getMainStorage().domainPrice;
    }

    /// Get rewards of address
    /// @param addressToCheck Address to check rewards
    function domainRewards(address addressToCheck) public view returns (uint256) {
        return _getMainStorage().domainRewards[addressToCheck];
    }

    /**
     * Register new domain
     * @param domainName Name of domain to register
     */
    function registerDomain(string memory domainName) external payable {
        MainStorage storage $ = _getMainStorage();

        require(msg.value >= $.domainPrice, "Ether value is lower than price.");
        require($.domainRecords[domainName] == address(0), "Domain has been purchased by someone before.");

        strings.slice memory s = domainName.toSlice();
        strings.slice memory delim = ".".toSlice();
        uint256 parts = s.count(delim);

        uint256 restValue = $.domainPrice;

        string memory localDomainName = "";

        for (uint i = 0; i < parts; i++) {
            if (i > 0) {
                localDomainName = string.concat(s.rsplit(delim).toString(), ".", localDomainName); // Join all domain parts
            } else {
                localDomainName = s.rsplit(delim).toString(); // or take last part of domain, if it first iteration
            }

            address domainOwner = $.domainRecords[localDomainName];
            require(domainOwner != address(0), "Not all domain levels has been registred.");

            if (domainOwner != address(0)) {
                uint256 reward = $.domainPrice / parts;
                $.domainRewards[domainOwner] += reward;

                restValue -= reward;
            }
        }

        $.domainRewards[owner()] += restValue;

        $.domainRecords[domainName] = msg.sender;
        emit DomainPurchase(msg.sender, domainName, block.timestamp);
    }

    /**
     * Set new price for domains (Only for owner)
     * @param newPrice New price for domains
     */
    function setDomainPrice(uint256 newPrice) external onlyOwner {
        MainStorage storage $ = _getMainStorage();
        $.domainPrice = newPrice;
        emit DomainPriceChanged($.domainPrice);
    }

    /**
     * Withdraws all ethers rewards from contract to owner
     * @param to Rewards receiver address
     */
    function withdrawAllEther(address payable to) external {
        MainStorage storage $ = _getMainStorage();

        uint256 balance = $.domainRewards[to];
        require(balance > 0, "Your rewards must be greater than 0.");

        $.domainRewards[to] = 0;

        (bool sent, ) = to.call{value: balance}("");
        require(sent, "Failed to send Ether rewards.");

        emit EtherWithdraw(to, balance);
    }
}
