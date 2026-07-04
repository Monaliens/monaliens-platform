/**
 * Monad Blinks Routes
 *
 * Dialect Blinks integration for flip only.
 */

const express = require("express");
const axios = require("axios");
const { ethers } = require("ethers");

const router = express.Router();

const MONAD_CHAIN_ID = 143;
const MONAD_RPC_URL =
  "process.env.RPC_URL";
const FRONTEND_URL = process.env.FRONTEND_URL_WWW || "https://www.your-domain";

const FLIP_CONTRACT_ADDRESS = "0x5CFcE619d3cC9ea21dd0d4da0Ea3C03E45d25c60";
const FLIP_ABI = [
  "function flipNative(bool choice) external payable",
  "function getEntropyFee() external view returns (uint256)",
];

const provider = new ethers.providers.JsonRpcProvider(MONAD_RPC_URL);

const BLINKS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Accept-Encoding, Accept, x-action-version, x-blockchain-ids",
  "Access-Control-Expose-Headers": "x-blockchain-ids, x-action-version",
  "x-blockchain-ids": `eip155:${MONAD_CHAIN_ID}`,
  "x-action-version": "2.4",
  "Content-Type": "application/json",
};

let cachedEntropyFee = null;
let entropyFeeTimestamp = 0;
const ENTROPY_FEE_CACHE_TTL = 5 * 60 * 1000;

async function getEntropyFee() {
  const now = Date.now();
  if (cachedEntropyFee && now - entropyFeeTimestamp < ENTROPY_FEE_CACHE_TTL) {
    return cachedEntropyFee;
  }

  try {
    const flipContract = new ethers.Contract(
      FLIP_CONTRACT_ADDRESS,
      FLIP_ABI,
      provider,
    );
    cachedEntropyFee = await flipContract.getEntropyFee();
    entropyFeeTimestamp = now;
    console.log(
      "Entropy fee fetched:",
      ethers.utils.formatEther(cachedEntropyFee),
      "MON",
    );
    return cachedEntropyFee;
  } catch (error) {
    console.error("Error fetching entropy fee:", error.message);
    return ethers.utils.parseEther("0.4");
  }
}

function encodeFlipNativeData(choice) {
  const iface = new ethers.utils.Interface(FLIP_ABI);
  return iface.encodeFunctionData("flipNative", [choice]);
}

router.options("/flip", (req, res) => {
  res.set(BLINKS_HEADERS);
  return res.status(200).end();
});

router.get("/flip", async (req, res) => {
  res.set(BLINKS_HEADERS);

  try {
    const entropyFee = await getEntropyFee();
    const entropyFeeFormatted = parseFloat(
      ethers.utils.formatEther(entropyFee),
    ).toFixed(4);

    return res.json({
      type: "action",
      icon: `${FRONTEND_URL}/assets/images/flip/head.png`,
      title: "Coin Flip",
      description: `Double your bet with a coin flip!\n\n1.9x Payout | Instant Result\nPick HEADS or TAILS\n\n(+${entropyFeeFormatted} MON entropy fee)`,
      label: "Flip Coin",
      links: {
        actions: [
          {
            type: "transaction",
            label: "HEADS - 10 MON",
            href: "/api/actions/flip?choice=heads&amount=10",
          },
          {
            type: "transaction",
            label: "HEADS - 100 MON",
            href: "/api/actions/flip?choice=heads&amount=100",
          },
          {
            type: "transaction",
            label: "TAILS - 10 MON",
            href: "/api/actions/flip?choice=tails&amount=10",
          },
          {
            type: "transaction",
            label: "TAILS - 100 MON",
            href: "/api/actions/flip?choice=tails&amount=100",
          },
          {
            type: "transaction",
            label: "HEADS - Custom",
            href: "/api/actions/flip?choice=heads&amount={headsAmount}",
            parameters: [
              {
                name: "headsAmount",
                label: "Bet amount (MON)",
                type: "number",
                required: true,
                min: 0.01,
                max: 1000,
              },
            ],
          },
          {
            type: "transaction",
            label: "TAILS - Custom",
            href: "/api/actions/flip?choice=tails&amount={tailsAmount}",
            parameters: [
              {
                name: "tailsAmount",
                label: "Bet amount (MON)",
                type: "number",
                required: true,
                min: 0.01,
                max: 1000,
              },
            ],
          },
        ],
      },
    });
  } catch (error) {
    console.error("Flip Blinks GET error:", error.message);
    return res.status(500).json({
      type: "action",
      icon: `${FRONTEND_URL}/assets/images/flip/head.png`,
      title: "Coin Flip Unavailable",
      description: "Unable to load coin flip. Please try again later.",
      label: "Unavailable",
      disabled: true,
      links: { actions: [] },
    });
  }
});

router.post("/flip", async (req, res) => {
  res.set(BLINKS_HEADERS);

  try {
    const { choice, amount } = req.query;
    const { account } = req.body;

    if (!account || !ethers.utils.isAddress(account)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const choiceLower = (choice || "").toLowerCase();
    if (choiceLower !== "heads" && choiceLower !== "tails") {
      return res
        .status(400)
        .json({ error: 'Invalid choice. Must be "heads" or "tails"' });
    }

    const betAmount = parseFloat(amount);
    if (isNaN(betAmount) || betAmount < 0.01 || betAmount > 1000) {
      return res.status(400).json({
        error: "Invalid bet amount. Must be between 0.01 and 1000 MON",
      });
    }

    const entropyFee = await getEntropyFee();
    const betAmountWei = ethers.utils.parseEther(betAmount.toString());
    const totalValueWei = betAmountWei.add(entropyFee);
    const isHeads = choiceLower === "heads";

    const transaction = {
      to: FLIP_CONTRACT_ADDRESS,
      data: encodeFlipNativeData(isHeads),
      value: totalValueWei.toString(),
      chainId: MONAD_CHAIN_ID.toString(),
    };

    return res.json({
      type: "transaction",
      transaction: JSON.stringify(transaction),
      message: `Flipping ${betAmount} MON on ${choiceLower.toUpperCase()}...`,
      links: {
        next: {
          type: "inline",
          action: {
            type: "completed",
            icon: `${FRONTEND_URL}/assets/images/flip/flip_animation.gif`,
            title: "Coin Flipped!",
            description: `Your ${betAmount} MON bet on ${choiceLower.toUpperCase()} was placed!\n\nResult will appear in your wallet within seconds.`,
            label: "Good luck!",
          },
        },
      },
    });
  } catch (error) {
    console.error("Flip Blinks POST error:", error.message);
    return res.status(500).json({
      error: "Failed to create flip transaction. Please try again.",
    });
  }
});

router.options("/flip/result", (req, res) => {
  res.set(BLINKS_HEADERS);
  return res.status(200).end();
});

router.get("/flip/result", async (req, res) => {
  res.set(BLINKS_HEADERS);

  const { wallet, choice, amount } = req.query;

  return res.json({
    type: "action",
    icon: `${FRONTEND_URL}/assets/images/flip/flip_animation.gif`,
    title: "Checking Result...",
    description: `Checking result for ${amount} MON bet on ${(choice || "HEADS").toUpperCase()}`,
    label: "Reveal",
    links: {
      actions: [
        {
          type: "post",
          label: "Reveal Result",
          href: `/api/actions/flip/result?wallet=${wallet}&choice=${choice}&amount=${amount}`,
        },
      ],
    },
  });
});

router.post("/flip/result", async (req, res) => {
  res.set(BLINKS_HEADERS);

  try {
    const { wallet, choice, amount } = req.query;
    const { account } = req.body;
    const playerWallet = wallet || account;

    if (!playerWallet) {
      return res.status(400).json({ error: "Wallet address required" });
    }

    let flipResult = null;
    try {
      const response = await axios.get(
        `${process.env.API_URL || "https://your-api-url"}/api/flip/user/${playerWallet}?limit=1`,
        { timeout: 10000 },
      );

      if (
        response.data &&
        response.data.success &&
        response.data.data &&
        response.data.data.length > 0
      ) {
        flipResult = response.data.data[0];
      }
    } catch (err) {
      console.error("Error fetching flip result:", err.message);
    }

    if (!flipResult || !flipResult.completed) {
      return res.json({
        type: "action",
        icon: `${FRONTEND_URL}/assets/images/flip/flip_animation.gif`,
        title: "Still Processing...",
        description:
          "Your flip is still being processed. Wait a moment and try again.",
        label: "Check Again",
        links: {
          actions: [
            {
              type: "post",
              label: "Check Again",
              href: `/api/actions/flip/result?wallet=${playerWallet}&choice=${choice}&amount=${amount}`,
            },
          ],
        },
      });
    }

    const won = flipResult.winner === true;
    const actualResult = (flipResult.result || "").toUpperCase();
    const betAmount = ethers.utils.formatEther(flipResult.amount || "0");
    const payout = won ? (parseFloat(betAmount) * 1.9).toFixed(2) : "0";
    const resultImage =
      actualResult.toLowerCase() === "heads" ? "head" : "tail";

    return res.json({
      type: "action",
      icon: `${FRONTEND_URL}/assets/images/flip/${resultImage}.png`,
      title: won ? "YOU WON!" : "YOU LOST",
      description: won
        ? `The coin landed on ${actualResult}!\n\nYou won ${payout} MON!`
        : `The coin landed on ${actualResult}.\n\nBetter luck next time!`,
      label: won ? "Winner!" : "Try Again",
      disabled: true,
      links: { actions: [] },
    });
  } catch (error) {
    console.error("Flip result error:", error.message);
    return res.status(500).json({
      error: "Failed to fetch result. Please try again.",
    });
  }
});

module.exports = router;
