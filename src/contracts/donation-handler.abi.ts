export const donationHandlerAbi = [
    {
        "type": "constructor",
        "inputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "receive",
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "donateERC20",
        "inputs": [
            {"name": "tokenAddress", "type": "address", "internalType": "address"},
            {"name": "recipientAddress", "type": "address", "internalType": "address"},
            {"name": "amount", "type": "uint256", "internalType": "uint256"},
            {"name": "data", "type": "bytes", "internalType": "bytes"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "donateETH",
        "inputs": [
            {"name": "recipientAddress", "type": "address", "internalType": "address"},
            {"name": "amount", "type": "uint256", "internalType": "uint256"},
            {"name": "data", "type": "bytes", "internalType": "bytes"}
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "donateManyERC20",
        "inputs": [
            {"name": "tokenAddress", "type": "address", "internalType": "address"},
            {"name": "totalAmount", "type": "uint256", "internalType": "uint256"},
            {"name": "recipientAddresses", "type": "address[]", "internalType": "address[]"},
            {"name": "amounts", "type": "uint256[]", "internalType": "uint256[]"},
            {"name": "data", "type": "bytes[]", "internalType": "bytes[]"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "donateManyETH",
        "inputs": [
            {"name": "totalAmount", "type": "uint256", "internalType": "uint256"},
            {"name": "recipientAddresses", "type": "address[]", "internalType": "address[]"},
            {"name": "amounts", "type": "uint256[]", "internalType": "uint256[]"},
            {"name": "data", "type": "bytes[]", "internalType": "bytes[]"}
        ],
        "outputs": [],
        "stateMutability": "payable"
    },
    {
        "type": "function",
        "name": "initialize",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "owner",
        "inputs": [],
        "outputs": [{"name": "", "type": "address", "internalType": "address"}],
        "stateMutability": "view"
    },
    {
        "type": "function",
        "name": "renounceOwnership",
        "inputs": [],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "function",
        "name": "transferOwnership",
        "inputs": [{"name": "newOwner", "type": "address", "internalType": "address"}],
        "outputs": [],
        "stateMutability": "nonpayable"
    },
    {
        "type": "event",
        "name": "DonationMade",
        "inputs": [
            {"name": "recipientAddress", "type": "address", "indexed": true, "internalType": "address"},
            {"name": "amount", "type": "uint256", "indexed": false, "internalType": "uint256"},
            {"name": "tokenAddress", "type": "address", "indexed": true, "internalType": "address"},
            {"name": "data", "type": "bytes", "indexed": false, "internalType": "bytes"}
        ],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "Initialized",
        "inputs": [{"name": "version", "type": "uint64", "indexed": false, "internalType": "uint64"}],
        "anonymous": false
    },
    {
        "type": "event",
        "name": "OwnershipTransferred",
        "inputs": [
            {"name": "previousOwner", "type": "address", "indexed": true, "internalType": "address"},
            {"name": "newOwner", "type": "address", "indexed": true, "internalType": "address"}
        ],
        "anonymous": false
    },
    {
        "type": "error",
        "name": "InsufficientAllowance",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidInitialization",
        "inputs": []
    },
    {
        "type": "error",
        "name": "InvalidInput",
        "inputs": []
    },
    {
        "type": "error",
        "name": "NotInitializing",
        "inputs": []
    },
    {
        "type": "error",
        "name": "OwnableInvalidOwner",
        "inputs": [{"name": "owner", "type": "address", "internalType": "address"}]
    },
    {
        "type": "error",
        "name": "OwnableUnauthorizedAccount",
        "inputs": [{"name": "account", "type": "address", "internalType": "address"}]
    },
    {
        "type": "error",
        "name": "ReentrancyGuardReentrantCall",
        "inputs": []
    }
]; 