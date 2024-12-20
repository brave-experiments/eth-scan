import { concat, encode, fromHex } from '@findeth/abi';
import IERC20Artifact from '@openzeppelin/contracts/build/contracts/IERC20.json';
import { MockContract, MockProvider } from 'ethereum-waffle';
import { Signer } from 'ethers';
import { waffle } from 'hardhat';
import BalanceScannerArtifact from '../artifacts/contracts/BalanceScanner.sol/BalanceScanner.json';
import { BalanceScanner } from '../src/contracts';

const { deployContract, deployMockContract, createFixtureLoader, provider } = waffle;

const loadFixture = createFixtureLoader(provider.getWallets(), provider);

/**
 * Remove object keys from an array.
 */
const getTuple = async <T extends unknown[]>(promise: Promise<T[]>): Promise<T[]> => {
  const data = await promise;
  return data.map((value) => [...value]) as T[];
};

/**
 * Low-level tests for the contract itself, using direct contract interactions. For the library itself, you can refer
 * to `src/eth-scan.test.ts`.
 */
describe('BalanceScanner', () => {
  const fixture = async (signers: Signer[], provider: MockProvider) => {
    const signer = signers[0];
    const contract = (await deployContract(signer, BalanceScannerArtifact)) as BalanceScanner;
    const token = (await deployMockContract(signer, IERC20Artifact.abi)) as MockContract;

    return { contract, signers, provider, token };
  };

  describe('etherBalances', () => {
    it('returns ether balances for addresses', async () => {
      const { contract, signers } = await loadFixture(fixture);

      const addresses = await Promise.all(signers.slice(1).map((signer) => signer.getAddress()));
      const balances = await Promise.all(signers.slice(1).map((signer) => signer.getBalance()));
      const expectedValue = await Promise.all(
        balances.map((balance) => [true, `0x${balance.toHexString().slice(2).padStart(64, '0')}`])
      );

      await expect(getTuple(contract.etherBalances(addresses))).resolves.toEqual(expectedValue);
    });

    it('returns an empty array when no addresses passed', async () => {
      const { contract } = await loadFixture(fixture);

      await expect(getTuple(contract.etherBalances([]))).resolves.toStrictEqual([]);
    });
  });

  describe('tokenBalances', () => {
    it('returns the token balances for addresses', async () => {
      const { contract, signers, token } = await loadFixture(fixture);

      await token.mock.balanceOf.returns('1000');

      const addresses = await Promise.all(signers.slice(1).map((signer) => signer.getAddress()));
      const expectedValue = await Promise.all(
        signers.slice(1).map(() => [true, '0x00000000000000000000000000000000000000000000000000000000000003e8'])
      );

      await expect(getTuple(contract.tokenBalances(addresses, token.address))).resolves.toStrictEqual(expectedValue);
    });

    it('returns the ether balance for a 0xEeee***EEeE address', async () => {
      const { contract, signers, token } = await loadFixture(fixture);
      const address = await signers[1].getAddress();
      const etherBalance = await signers[1].getBalance();

      await expect(
        getTuple(contract.tokenBalances([address], '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'))
      ).resolves.toEqual([[true, `0x${etherBalance.toHexString().slice(2).padStart(64, '0')}`]]);
    });

    it('returns an empty array when no addresses passed', async () => {
      const { contract, token } = await loadFixture(fixture);

      await expect(getTuple(contract.tokenBalances([], token.address))).resolves.toStrictEqual([]);
    });

    it('does not fail when a token is invalid', async () => {
      const { contract, signers, token } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      await expect(getTuple(contract.tokenBalances([address], token.address))).resolves.toStrictEqual([[false, '0x']]);
    });
  });

  describe('tokensBalance', () => {
    it('returns the token balance for multiple tokens, for a single address', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      const tokenA = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenA.mock.balanceOf.returns('1000');

      const tokenB = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenB.mock.balanceOf.returns('1');

      await expect(getTuple(contract.tokensBalance(address, [tokenA.address, tokenB.address]))).resolves.toEqual([
        [true, '0x00000000000000000000000000000000000000000000000000000000000003e8'],
        [true, '0x0000000000000000000000000000000000000000000000000000000000000001']
      ]);
    });

    it('returns the ether balance for a 0xEeee***EEeE address', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[1].getAddress();
      const etherBalance = await signers[1].getBalance();

      await expect(
        getTuple(contract.tokensBalance(address, ['0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE']))
      ).resolves.toEqual([[true, `0x${etherBalance.toHexString().slice(2).padStart(64, '0')}`]]);
    });

    it('returns an empty array when no addresses passed', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      await expect(getTuple(contract.tokensBalance(address, []))).resolves.toStrictEqual([]);
    });

    it('does not fail when a token is invalid', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      const tokenA = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenA.mock.balanceOf.returns('1000');

      const tokenB = await deployMockContract(signers[0], IERC20Artifact.abi);

      await expect(getTuple(contract.tokensBalance(address, [tokenA.address, tokenB.address]))).resolves.toEqual([
        [true, '0x00000000000000000000000000000000000000000000000000000000000003e8'],
        [false, '0x']
      ]);
    });
  });

  describe('call', () => {
    it('calls the targets with the specified data', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      const tokenA = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenA.mock.balanceOf.returns('1000');

      const tokenB = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenB.mock.balanceOf.returns('1');

      const data = concat([fromHex('70a08231'), encode(['address'], [address])]);

      await expect(
        getTuple(contract['call(address[],bytes[])']([tokenA.address, tokenB.address], [data, data]))
      ).resolves.toStrictEqual([
        [true, '0x00000000000000000000000000000000000000000000000000000000000003e8'],
        [true, '0x0000000000000000000000000000000000000000000000000000000000000001']
      ]);
    });

    it('does not fail when a contract is invalid', async () => {
      const { contract, signers } = await loadFixture(fixture);
      const address = await signers[0].getAddress();

      const tokenA = await deployMockContract(signers[0], IERC20Artifact.abi);
      await tokenA.mock.balanceOf.returns('1000');

      const tokenB = await deployMockContract(signers[0], IERC20Artifact.abi);

      const data = concat([fromHex('70a08231'), encode(['address'], [address])]);

      await expect(
        getTuple(contract['call(address[],bytes[])']([tokenA.address, tokenB.address, address], [data, data, data]))
      ).resolves.toStrictEqual([
        [true, '0x00000000000000000000000000000000000000000000000000000000000003e8'],
        [false, '0x'],
        [false, '0x']
      ]);
    });
  });
});
