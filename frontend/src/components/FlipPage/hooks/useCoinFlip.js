import { useState, useCallback, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount, usePublicClient } from 'wagmi';
import { parseEther, formatEther, decodeEventLog, encodeFunctionData } from 'viem';
import {
  COIN_FLIP_CONTRACT_ADDRESS,
  COIN_FLIP_ABI,
  LMON_TOKEN_ADDRESS,
  ERC20_ABI
} from '../utils/constants';
import { getEntropyFeeLimitWei } from '../../../utils/entropyFeeSettings';
import { playSound } from '../utils/audioManager';
import { useGameWallet } from '../../../context';
import toast from 'react-hot-toast';

export const useCoinFlip = ({ refetchBalance } = {}) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { isUsingGameWallet, sendTransaction: gameWalletSendTx, refreshBalance: refreshGameBalance, canAfford, getShortage, GAS_RESERVE } = useGameWallet();
  const [txState, setTxState] = useState('idle'); // 'idle', 'pending', 'confirming', 'waiting-result', 'success', 'error'
  const [txHash, setTxHash] = useState(null);
  const [sequenceNumber, setSequenceNumber] = useState(null);
  const [error, setError] = useState(null);
  const [pendingFlip, setPendingFlip] = useState(null); // { choice, amount }
  const [lastContractAddress, setLastContractAddress] = useState(null);

  const { writeContract, data: writeData, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isTxError, error: txReceiptError } = useWaitForTransactionReceipt({
    hash: writeData,
    enabled: !!writeData
  });

  // Get entropy fee
  const { data: entropyFee } = useReadContract({
    address: COIN_FLIP_CONTRACT_ADDRESS,
    abi: COIN_FLIP_ABI,
    functionName: 'getEntropyFee'
  });

  // Get LMON balance
  const { data: lmonBalance } = useReadContract({
    address: LMON_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
    enabled: !!address
  });

  // Get LMON allowance
  const { data: lmonAllowance } = useReadContract({
    address: LMON_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address, COIN_FLIP_CONTRACT_ADDRESS],
    enabled: !!address
  });

  // Approve LMON
  const approveLMON = useCallback(async (amount, choice, betAmount) => {
    try {
      setTxState('pending');
      setError(null);
      
      // Store pending flip parameters
      if (choice !== undefined && betAmount) {
        setPendingFlip({ choice, amount: betAmount });
      }

      // Mark that we're calling LMON token contract
      setLastContractAddress(LMON_TOKEN_ADDRESS);

      writeContract({
        address: LMON_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [COIN_FLIP_CONTRACT_ADDRESS, amount]
      });
    } catch (err) {
      // Check if user rejected the transaction
      if (err.message?.includes('rejected') || err.message?.includes('denied') || err.message?.includes('User denied')) {
        setError('Transaction rejected');
        setTxState('error');
        setPendingFlip(null);
        setLastContractAddress(null);
        toast.error('Transaction rejected');
      } else {
        setError(err.message);
        setTxState('error');
        setPendingFlip(null);
        setLastContractAddress(null);
        toast.error('Approval failed: ' + err.message);
      }
    }
  }, [writeContract]);

  // Flip with Native MON
  const flipNative = useCallback(async (choice, betAmount) => {
    if (!entropyFee) {
      toast.error('Loading entropy fee...');
      return;
    }

    // Check if entropy fee exceeds user's custom limit
    const maxEntropyFee = getEntropyFeeLimitWei();
    if (entropyFee > maxEntropyFee) {
      toast.error('Fee exceeds your limit! Adjust in settings or try later.');
      return;
    }

    const betAmountWei = parseEther(betAmount.toString());
    const totalAmount = betAmountWei + entropyFee;
    const entropyFeeInMon = parseFloat(formatEther(entropyFee));

    // ===== GAME WALLET MODE =====
    if (isUsingGameWallet) {
      // Check if game wallet can afford the bet + fees + reserve
      const totalNeeded = parseFloat(betAmount) + entropyFeeInMon;
      if (!canAfford(totalNeeded)) {
        const shortage = getShortage(totalNeeded);
        toast.error(`Insufficient game wallet balance! Need ${(totalNeeded + GAS_RESERVE).toFixed(2)} MON (including ${GAS_RESERVE} MON reserve). Short by ${shortage.toFixed(2)} MON.`);
        return;
      }

      try {
        setTxState('pending');
        setError(null);
        setTxHash(null);
        setSequenceNumber(null);

        // Play bet sound
        playSound('bet');

        // Encode function call
        const data = encodeFunctionData({
          abi: COIN_FLIP_ABI,
          functionName: 'flipNative',
          args: [choice]
        });

        // Send via game wallet (signless!)
        const { hash, receipt } = await gameWalletSendTx({
          to: COIN_FLIP_CONTRACT_ADDRESS,
          value: totalAmount,
          data
        });

        setTxHash(hash);
        setTxState('waiting-result');
        setLastContractAddress(COIN_FLIP_CONTRACT_ADDRESS);

        // Play flip sound
        playSound('flip');

        // Extract sequence number from receipt
        if (receipt?.logs) {
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: COIN_FLIP_ABI,
                data: log.data,
                topics: log.topics
              });
              if (decoded.eventName === 'CoinflipStarted') {
                setSequenceNumber(decoded.args.sequenceNumber);
                break;
              }
            } catch (e) {
              // Not our event
            }
          }
        }

        // Refresh game wallet balance
        refreshGameBalance?.();
        refetchBalance?.();

      } catch (err) {
        if (err.message?.includes('rejected') || err.message?.includes('denied')) {
          setError('Transaction rejected');
          setTxState('error');
          toast.error('Transaction rejected');
        } else {
          setError(err.message);
          setTxState('error');
          toast.error('Flip failed: ' + err.message);
        }
      }
      return;
    }

    // ===== MAIN WALLET MODE (existing flow) =====
    try {
      setTxState('pending');
      setError(null);
      setTxHash(null);
      setSequenceNumber(null);

      // Play bet sound
      playSound('bet');

      setLastContractAddress(COIN_FLIP_CONTRACT_ADDRESS);

      writeContract({
        address: COIN_FLIP_CONTRACT_ADDRESS,
        abi: COIN_FLIP_ABI,
        functionName: 'flipNative',
        args: [choice],
        value: totalAmount
      });
    } catch (err) {
      // Check if user rejected the transaction
      if (err.message?.includes('rejected') || err.message?.includes('denied') || err.message?.includes('User denied')) {
        setError('Transaction rejected');
        setTxState('error');
        toast.error('Transaction rejected');
      } else {
        setError(err.message);
        setTxState('error');
        toast.error('Flip failed: ' + err.message);
      }
    }
  }, [entropyFee, writeContract, isUsingGameWallet, gameWalletSendTx, refreshGameBalance, refetchBalance, canAfford, getShortage, GAS_RESERVE]);

  // Flip with LMON
  const flipLMON = useCallback(async (choice, amount) => {
    if (!entropyFee) {
      toast.error('Loading entropy fee...');
      return;
    }

    // Check if entropy fee exceeds user's custom limit
    const maxEntropyFee = getEntropyFeeLimitWei();
    if (entropyFee > maxEntropyFee) {
      toast.error('Fee exceeds your limit! Adjust in settings or try later.');
      return;
    }

    if (!publicClient || !address) {
      toast.error('Wallet not connected');
      return;
    }

    const amountWei = parseEther(amount.toString());

    // Check allowance directly from contract (like in script)
    let currentAllowance;
    try {
      currentAllowance = await publicClient.readContract({
        address: LMON_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, COIN_FLIP_CONTRACT_ADDRESS]
      });
    } catch (err) {
      toast.error('Error checking allowance');
      return;
    }

    // If allowance is insufficient, approve first (like script does)
    if (!currentAllowance || currentAllowance < amountWei) {
      // Need approval - this will trigger automatic flip after approval
      await approveLMON(amountWei, choice, amount);
      return;
    }

    // Allowance is sufficient, proceed with flip (like script: after approveTx.wait())
    // Script: coinFlip.flipLMON(true, betAmount, { value: entropyFee })
    try {
      setTxState('pending');
      setError(null);
      setTxHash(null);
      setSequenceNumber(null);
      setPendingFlip(null);
      setLastContractAddress(COIN_FLIP_CONTRACT_ADDRESS);

      // Play bet sound
      playSound('bet');

      writeContract({
        address: COIN_FLIP_CONTRACT_ADDRESS,
        abi: COIN_FLIP_ABI,
        functionName: 'flipLMON',
        args: [choice, amountWei], // Script: flipLMON(true, betAmount)
        value: entropyFee // Script: { value: entropyFee } - BigInt from hook
      });
    } catch (err) {
      // Check if user rejected the transaction
      if (err.message?.includes('rejected') || err.message?.includes('denied') || err.message?.includes('User denied')) {
        setError('Transaction rejected');
        setTxState('error');
        setPendingFlip(null);
        toast.error('Transaction rejected');
      } else {
        setError(err.message);
        setTxState('error');
        setPendingFlip(null);
        toast.error('Flip failed: ' + err.message);
      }
    }
  }, [entropyFee, writeContract, approveLMON, publicClient, address]);

  // Watch transaction state
  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
    }
  }, [writeData]);

  // Handle transaction failure (revert, out of gas, etc.)
  useEffect(() => {
    if (isTxError && txReceiptError) {
      const errorMessage = txReceiptError.message || '';
      
      // Reset state on failure
      setTxState('error');
      setError(errorMessage);
      setTxHash(null);
      setSequenceNumber(null);
      setPendingFlip(null);
      setLastContractAddress(null);
      
      toast.error('Transaction failed: ' + (errorMessage.includes('reverted') ? 'Execution reverted' : errorMessage));
    }
  }, [isTxError, txReceiptError]);

  useEffect(() => {
    if (isPending) {
      setTxState('pending');
    } else if (isConfirming) {
      setTxState('confirming');
    } else if (isConfirmed && txHash && lastContractAddress) {
      // Check if this was an approval transaction (LMON token contract)
      if (lastContractAddress.toLowerCase() === LMON_TOKEN_ADDRESS.toLowerCase()) {
        setLastContractAddress(null);
        
        // If we have pending flip, execute it automatically after approval
        // Similar to script: await approveTx.wait() then flipLMON()
        if (pendingFlip) {
          toast.success('Approval successful! Executing flip...');
          
          // Execute flip after approval is confirmed (like script does)
          const executeFlip = async () => {
            try {
              // Small delay to ensure approval is fully processed on-chain
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Now execute the flip directly (allowance is already approved)
              // Don't check allowance again, just execute flip like script does
              const amountWei = parseEther(pendingFlip.amount.toString());
              
              // Ensure entropyFee is available (should be BigInt from hook)
              if (!entropyFee) {
                throw new Error('Entropy fee not loaded');
              }
              
              setTxState('pending');
              setError(null);
              setTxHash(null);
              setSequenceNumber(null);
              setLastContractAddress(COIN_FLIP_CONTRACT_ADDRESS);
              
              // Play bet sound
              playSound('bet');
              
              // Script: coinFlip.flipLMON(true, betAmount, { value: entropyFee })
              writeContract({
                address: COIN_FLIP_CONTRACT_ADDRESS,
                abi: COIN_FLIP_ABI,
                functionName: 'flipLMON',
                args: [pendingFlip.choice, amountWei], // Script: flipLMON(true, betAmount)
                value: entropyFee // Script: { value: entropyFee } - BigInt from hook
              });
              
              setPendingFlip(null);
            } catch (err) {
              setError(err.message);
              setTxState('error');
              setPendingFlip(null);
              toast.error('Flip failed after approval: ' + err.message);
            }
          };
          
          executeFlip();
        }
      } else {
        // This is a flip transaction (CoinFlip contract)
        setTxState('waiting-result');
        setLastContractAddress(null);
        // Play flip sound (not looping)
        playSound('flip');
        // Refresh balance after flip transaction is confirmed
        refetchBalance?.();
      }
    }
  }, [isPending, isConfirming, isConfirmed, txHash, lastContractAddress, pendingFlip, entropyFee, writeContract, refetchBalance]);

  // Extract sequence number from transaction receipt (only for flip transactions)
  useEffect(() => {
    const extractSequenceNumber = async () => {
      // Only extract sequence number for flip transactions, not approvals
      if (isConfirmed && txHash && publicClient && lastContractAddress && 
          lastContractAddress.toLowerCase() === COIN_FLIP_CONTRACT_ADDRESS.toLowerCase()) {
        try {
          const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
          const logs = receipt.logs;
          
          // Find CoinflipStarted event
          for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            try {
              const decoded = decodeEventLog({
                abi: COIN_FLIP_ABI,
                data: log.data,
                topics: log.topics
              });
              
              if (decoded.eventName === 'CoinflipStarted') {
                const seqNum = decoded.args.sequenceNumber;
                setSequenceNumber(seqNum);
                break;
              }
            } catch (e) {
              // Not our event, continue
            }
          }
        } catch (err) {
          // Error extracting sequence number
        }
      }
    };

    extractSequenceNumber();
  }, [isConfirmed, txHash, publicClient, lastContractAddress]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      const errorMessage = writeError.message || '';

      // Check if user rejected the transaction
      if (errorMessage.includes('rejected') ||
          errorMessage.includes('denied') ||
          errorMessage.includes('User denied') ||
          errorMessage.includes('User rejected')) {
        setError('Transaction rejected');
        setTxState('error');
        toast.error('Transaction rejected');
      } else {
        setError(errorMessage);
        setTxState('error');
        toast.error('Transaction failed: ' + errorMessage);
      }
    }
  }, [writeError]);

  // Check if approval is needed (allowance is less than a reasonable amount)
  const needsApproval = lmonAllowance ? lmonAllowance < parseEther("1000") : true;

  // Reset flip state function - call this when result is received
  const resetFlipState = useCallback(() => {
    setTxState('idle');
    setTxHash(null);
    setSequenceNumber(null);
    setError(null);
    setPendingFlip(null);
    setLastContractAddress(null);
  }, []);

  return {
    flipNative,
    flipLMON,
    approveLMON,
    txState,
    txHash,
    sequenceNumber,
    error,
    entropyFee: entropyFee ? formatEther(entropyFee) : null,
    lmonBalance: lmonBalance ? formatEther(lmonBalance) : null,
    lmonAllowance: lmonAllowance ? formatEther(lmonAllowance) : null,
    needsApproval,
    resetFlipState,
    isUsingGameWallet
  };
};
