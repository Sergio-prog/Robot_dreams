// SPDX-License-Identifier: UNLICENSED

import "./interfaces/IRegistrarController.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity ^0.8;

/// @title A simple domain registry
/// @author Sergey Nesterov (Sergio-Prog)
contract RegistrarController is IRegistrarController, Ownable {
    uint public domainPrice;

    mapping (string => address) private domainRecords;

    constructor(address _owner, uint _domainPrice) Ownable(_owner) {
        domainPrice = _domainPrice;
    }

    /// @inheritdoc IRegistrarController
    function getDomainController(string memory domainName) external view returns (address) {
        // require(domainRecords[domainName] != address(0), "Domain controller not found.");
        return domainRecords[domainName];
    }

    /// @inheritdoc IRegistrarController
    function registerDomain(string memory domainName) payable external {
        require(msg.value >= domainPrice, "Ether value is lower than price.");
        require(domainRecords[domainName] == address(0), "Domain has been purchased by someone before.");

        domainRecords[domainName] = msg.sender;
        emit DomainPurchase(msg.sender, domainName, block.timestamp);
    }

    /// @inheritdoc IRegistrarController
    function setDomainPrice(uint newPrice) external onlyOwner {
        domainPrice = newPrice;
    }

    /// @inheritdoc IRegistrarController
    function withdrawAllEther(address payable to) external onlyOwner {
        uint balance = address(this).balance;
        (bool sent, bytes memory data) = to.call{value: balance}("");
        require(sent, "Failed to send Ether");

        emit EtherWithdraw(to, balance);
    }
}
