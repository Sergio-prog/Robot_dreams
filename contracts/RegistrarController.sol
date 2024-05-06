// SPDX-License-Identifier: UNLICENSED

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV2V3Interface.sol";

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
        /// @notice Current price of domain in USD
        uint256 domainPrice;

        /// @notice Current domain price decimals
        uint8 priceDecimals;

        /// @dev Map with domainName -> owner
        mapping(string => address) domainRecords;

        /// @notice Rewards for register subdomain for domain owner
        mapping(address owner => mapping(address token => uint256 amount)) domainRewards;

        /// @notice ETH/USD Oracle address
        AggregatorV3Interface oracle;

        /// @notice Stableocoin contract address
        ERC20 stablecoinAddress;
        
        /// @notice Default ethereum address
        address etherAddress;
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
     * Withdraw all stablecoin rewards from contract
     * @param to Receiver of rewards
     * @param value Rewards withdraw amount
     */
    event StablecoinWithdraw(address indexed to, uint256 indexed value);

    /**
     * The price of the domain has been changed event
     * @param newPrice The new domain price
     */
    event DomainPriceChanged(uint256 newPrice);

    /// @dev Failed to transfer stablecoin to domainRegistry
    error FailedToTransferStablecoin();

    /// @dev Returns slot of storage location
    function _getMainStorage() private pure returns (MainStorage storage $) {
        assembly {
            $.slot := MAIN_STORAGE_LOCATION
        }
    }

    /**
     * Contract init
     * @param _owner Owner address of contract
     * @param _domainPrice Init domain price in USD
     */
    function initialize(address _owner, uint256 _domainPrice, uint8 _decimals, address _oracle, address _stablecoinAddress) public initializer {
        __Ownable_init(_owner);
        _getMainStorage().domainPrice = _domainPrice;
        _getMainStorage().priceDecimals = _decimals;
        emit DomainPriceChanged(_domainPrice);

        _getMainStorage().oracle = AggregatorV3Interface(_oracle);
        _getMainStorage().stablecoinAddress = ERC20(_stablecoinAddress);
        _getMainStorage().etherAddress = address(0);
    }

    /**
     * Return controller of domain
     * @param domainName Name of domain to check
     */
    function getDomainController(string memory domainName) external view returns (address) {
        return _getMainStorage().domainRecords[domainName];
    }

    /// Returns current ETH price feed
    function getETHPriceFeed() public view returns (uint256) {
        MainStorage storage $ = _getMainStorage();
        (
            , int256 price, , ,
        ) = $.oracle.latestRoundData();

        uint8 decimals = $.oracle.decimals();
        return uint256(uint256(price) / 10 ** uint256(decimals));
    }

    /// Current domain price in USD
    function domainPrice() external view returns (uint256) {
        return _getMainStorage().domainPrice;
    }
    
    /// Current domain price in ETH
    function ethDomainPrice() public view returns (uint256) {
        MainStorage storage $ = _getMainStorage();
        uint256 ethPrice = getETHPriceFeed();
        require(ethPrice != 0, "ETH price feed is zero");

        return ($.domainPrice / ethPrice) * 10 ** (18 - $.priceDecimals);
    }

    /// Get rewards of address. Returns ether rewards and stablecoin rewards
    /// @param addressToCheck Address to check rewards
    function domainRewards(address addressToCheck) public view returns (uint256, uint256) {
        MainStorage storage $ = _getMainStorage();
        return ($.domainRewards[addressToCheck][$.etherAddress], $.domainRewards[addressToCheck][address($.stablecoinAddress)]);
    }

    /**
     * Register new domain
     * @param domainName Name of domain to register
     */
    function registerDomain(string memory domainName, bool isStableCoinPay) external payable {
        MainStorage storage $ = _getMainStorage();

        require($.domainRecords[domainName] == address(0), "Domain has been purchased by someone before.");

        uint256 restValue = $.domainPrice;
        uint256 rewardDecimals = $.stablecoinAddress.decimals() - $.priceDecimals;
        
        uint256 stablecoinDomainPrice = $.domainPrice * 10 ** rewardDecimals;

        if (isStableCoinPay == true) {
            require($.stablecoinAddress.balanceOf(msg.sender) >= stablecoinDomainPrice, "Your balance is too low.");

            bool success = $.stablecoinAddress.transferFrom(msg.sender, address(this), stablecoinDomainPrice);
            if (!success) revert FailedToTransferStablecoin();
        } else {
            require(msg.value >= ethDomainPrice(), "Ether value is lower than price.");
        }

        strings.slice memory s = domainName.toSlice();
        strings.slice memory delim = ".".toSlice();
        uint256 parts = s.count(delim);

        string memory localDomainName = "";

        for (uint256 i = 0; i < parts; i++) {
            if (i > 0) {
                localDomainName = string.concat(s.rsplit(delim).toString(), ".", localDomainName); // Join all domain parts
            } else {
                localDomainName = s.rsplit(delim).toString(); // or take last part of domain, if it first iteration
            }

            address domainOwner = $.domainRecords[localDomainName];
            require(domainOwner != address(0), "Not all domain levels has been registred.");

            if (domainOwner != address(0)) {
                uint256 reward = $.domainPrice / parts;
                if (isStableCoinPay == true) {
                    uint256 stablecoinReward = reward * 10 ** rewardDecimals;

                    $.domainRewards[domainOwner][address($.stablecoinAddress)] += stablecoinReward;
                } else {
                    uint256 ethReward = (reward) / getETHPriceFeed() * 10 ** (18 - $.priceDecimals);
                    $.domainRewards[domainOwner][$.etherAddress] += ethReward;
                }
                restValue -= reward;
            }
        }

        $.domainRewards[owner()][$.etherAddress] += (restValue) / getETHPriceFeed() * 10 ** (18 - $.priceDecimals);

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

    /// Withdraws all ethers rewards from contract to owner
    function withdrawAllRewards() external {
        MainStorage storage $ = _getMainStorage();

        address from = msg.sender;

        uint256 balance = $.domainRewards[from][$.etherAddress];
        uint256 stablecoinBalance = $.domainRewards[from][address($.stablecoinAddress)];

        if (balance == 0 && stablecoinBalance == 0) {
            revert("Your rewards is 0.");
        }

        if (balance > 0) {
            $.domainRewards[from][$.etherAddress] = 0;

            (bool sent, ) = from.call{value: balance}("");
            require(sent, "Failed to send Ether rewards.");

            emit EtherWithdraw(from, balance);
        }

        if (stablecoinBalance > 0) {
            $.domainRewards[from][address($.stablecoinAddress)] = 0;

            bool sent = $.stablecoinAddress.transfer(from, stablecoinBalance);
            require(sent, "Failed to send stablecoin rewards.");

            emit StablecoinWithdraw(from, stablecoinBalance);
        }
    }
}
