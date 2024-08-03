// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8;


/// @title Interface of Registrar Controller
/// @author Sergey Nesterov (Sergio-Prog)
interface IRegistrarController {
    event DomainPurchase(address indexed owner, string indexed domainName, uint indexed timestamp);
    event EtherWithdraw(address indexed to, uint indexed value);

    /// Return controller of domain
    /// @param domainName Name of domain to check
    function getDomainController(string memory domainName) external view returns (address);

    /// Register new domain
    /// @param domainName Name of domain to register
    function registerDomain(string memory domainName) payable external;

    /// Set new price for domains (Only for owner)
    /// @param newPrice New price for domains
    function setDomainPrice(uint newPrice) external;

    /// Withdraws all ethers from contract to owner
    function withdrawAllEther(address payable to) external;
}
