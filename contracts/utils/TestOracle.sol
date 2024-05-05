// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV2V3Interface.sol";

contract TestOracle is AggregatorV2V3Interface {
    uint8 public override decimals;
    uint256 public override constant version = 1;

    int256 public override latestAnswer;
    uint256 public override latestTimestamp;
    uint256 public override latestRound;

    mapping(uint256 => int256) public getAnswer;
    mapping(uint256 => uint256) public getTimestamp;

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function setLatestRoundData(int256 price) public {
        latestAnswer = price;

        latestRound++;
        latestTimestamp = block.timestamp;
        
        getAnswer[latestRound] = latestAnswer;
        getTimestamp[latestRound] = latestTimestamp;

        emit AnswerUpdated(latestAnswer, latestRound, latestTimestamp);
    }

    function getRoundData(uint80 _roundId) external view virtual override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound) {
        return (_roundId, getAnswer[_roundId], getTimestamp[_roundId], getTimestamp[_roundId], _roundId);
    }

    function latestRoundData() public view virtual override returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (
            uint80(latestRound),
            getAnswer[latestRound],
            getTimestamp[latestRound],
            getTimestamp[latestRound],
            uint80(latestRound)
        );
    }

    /**
    * @notice returns the description of the aggregator the proxy points to.
    */
    function description()
        external
        view
        override
        returns (string memory)
    {
        return "ETH/USD";
    }
}