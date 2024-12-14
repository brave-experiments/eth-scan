// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

/**
 * @title An Ether or token balance scanner
 * @author Maarten Zuidhoorn
 * @author Luit Hollander
 * @author Anirudha Bose
 */
contract BalanceScanner {
  struct Result {
    bool success;
    bytes data;
  }

  uint256 private constant BALANCE_OF_GAS = 20_000;

  function etherBalances(address[] calldata addresses) external view returns (Result[] memory results) {
    results = new Result[](addresses.length);

    for (uint256 i = 0; i < addresses.length; i++) {
      results[i] = Result(true, abi.encode(addresses[i].balance));
    }
  }

  function tokenBalances(address[] calldata addresses, address token) external view returns (Result[] memory results) {
    results = new Result[](addresses.length);

    for (uint256 i = 0; i < addresses.length; i++) {
      if (token == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
        results[i] = Result(true, abi.encode(addresses[i].balance));
      } else {
        bytes memory data = abi.encodeWithSignature("balanceOf(address)", addresses[i]);
        results[i] = staticCall(token, data, BALANCE_OF_GAS);
      }
    }
  }

  function tokensBalance(address owner, address[] calldata contracts) external view returns (Result[] memory results) {
    results = new Result[](contracts.length);

    bytes memory data = abi.encodeWithSignature("balanceOf(address)", owner);
    for (uint256 i = 0; i < contracts.length; i++) {
      if (contracts[i] == 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE) {
        results[i] = Result(true, abi.encode(owner.balance));
      } else {
        results[i] = staticCall(contracts[i], data, BALANCE_OF_GAS);
      }
    }
  }

  function call(address[] calldata contracts, bytes[] calldata data) external view returns (Result[] memory results) {
    return call(contracts, data, gasleft());
  }

  function call(
    address[] calldata contracts,
    bytes[] calldata data,
    uint256 gas
  ) public view returns (Result[] memory results) {
    require(contracts.length == data.length, "Length must be equal");
    results = new Result[](contracts.length);

    for (uint256 i = 0; i < contracts.length; i++) {
      results[i] = staticCall(contracts[i], data[i], gas);
    }
  }

  function staticCall(
    address target,
    bytes memory data,
    uint256 gas
  ) private view returns (Result memory) {
    uint256 size = codeSize(target);

    if (size > 0) {
      (bool success, bytes memory result) = target.staticcall{ gas: gas }(data);
      if (success) {
        return Result(success, result);
      }
    }

    return Result(false, "");
  }

  function codeSize(address _address) private view returns (uint256 size) {
    assembly {
      size := extcodesize(_address)
    }
  }
}
