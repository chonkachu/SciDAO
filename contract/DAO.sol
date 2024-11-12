// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DAO {
    struct Vote {
        uint256 tokens;
        bool hasVoted;
    }

    struct Round {
        uint startTime;
        uint totalVotesCast;
        bool completed;
        bool rewardDistributed;
        uint version;
        mapping(address => mapping(uint => bool)) hasVoted;
    }

    struct CommunityCheck {
        bool initiated;
        bool completed;
        uint currentRound;
        uint totalRounds;
        uint voterCount;
        uint requiredVotes;
        mapping(uint => Round) rounds;
    }

    struct Project {
        uint id;
        address proposer;
        string name;
        string pdfLink;
        uint initialTokens;
        uint totalVotes;
        uint totalStake;
        bool exists;
        bool completed;
        CommunityCheck communityCheck;
        mapping(address => Vote) votes;
    }

    struct UserInfo {
        string name;
        string email;
        uint amountDeposited;
        bool exists;
    }
    

    event FundsReceived(address indexed from, uint amount);
    event ProjectProposed(uint indexed projectId, address indexed proposer, string name, uint tokens);
    event VoteCast(uint indexed projectId, address indexed voter, uint tokens);
    event ProjectCompleted(uint indexed projectId, address indexed proposer, uint totalTokens);
    event UserRegistered(address indexed user, string name, string email, uint amountDeposited);
    event TokensDeposited(address indexed user, uint tokens, uint newBalance);
    event TokensWithdrawn(address indexed user, uint tokens, uint etherAmount);

    event CommunityCheckInitiated(uint indexed projectId, uint timestamp);
    event CommunityCheckCompleted(uint indexed projectId, uint timestamp);
    event RoundVoteCast(uint indexed projectId, uint indexed roundNumber, address indexed voter);
    event RoundCompleted(uint indexed projectId, uint indexed roundNumber, bool rewardDistributed);
    event RewardDistributed(uint indexed projectId, uint indexed roundNumber, uint amount);
    event RoundReset(uint indexed projectId, uint indexed roundNumber, uint version, uint timestamp);
    
    uint public nextProjectId;
    uint public constant VOTE_THRESHOLD = 100; // Project succeeds when it gets 100 tokens worth of votes
    uint public constant COMMUNITY_CHECK_ROUNDS = 10;
    uint public constant ROUND_DURATION = 7 days;
    uint public constant REWARD_PERCENTAGE = 10;  // 10% per successful 

    mapping(uint => Project) projects;
    mapping(address => uint) public userTokenBalance;
    mapping(address => UserInfo) public users;
    
    uint256 constant TOKENS_TO_WEI = 1000*1000000000;  // 1 token = 1000 Gwei
    
    function getBalance() public view returns (uint) {
        return address(this).balance;
    }

    function registerUser(string memory name, string memory email) external payable {
        require(msg.value > TOKENS_TO_WEI, "Deposit must be at least 1 token");
        require(!users[msg.sender].exists, "User already registered");
        
        // Store user data
        users[msg.sender] = UserInfo({
            name: name,
            email: email,
            amountDeposited: msg.value,
            exists: true
        });
        
        // Convert initial deposit to tokens
        uint tokens = msg.value / TOKENS_TO_WEI;
        userTokenBalance[msg.sender] = tokens;
        
        emit UserRegistered(msg.sender, name, email, msg.value);
        emit TokensDeposited(msg.sender, tokens, tokens);
    }
    
    function depositTokens() external payable {
        require(users[msg.sender].exists, "User not registered");
        require(msg.value > TOKENS_TO_WEI, "Deposit must be at least 1 token");
        
        uint tokens = msg.value / TOKENS_TO_WEI;
        
        // Update user's deposited amount and token balance
        users[msg.sender].amountDeposited += msg.value;
        userTokenBalance[msg.sender] += tokens;
        
        emit TokensDeposited(msg.sender, tokens, userTokenBalance[msg.sender]);
    }
    
    function proposeProject(
        string memory name,
        string memory pdfLink,
        uint tokensToUse
    ) external {
        require(users[msg.sender].exists, "User not registered");
        require(userTokenBalance[msg.sender] >= tokensToUse, "Insufficient tokens");
        
        // Deduct tokens
        userTokenBalance[msg.sender] -= tokensToUse;
        
        // Create new project
        uint projectId = nextProjectId++;
        Project storage newProject = projects[projectId];
        newProject.id = projectId;
        newProject.proposer = msg.sender;
        newProject.name = name;
        newProject.pdfLink = pdfLink;
        newProject.initialTokens = tokensToUse;
        newProject.totalVotes = tokensToUse; // Initial tokens count as votes
        newProject.exists = true;
        newProject.completed = false;
        
        // Register proposer's initial tokens as votes
        newProject.votes[msg.sender] = Vote({
            tokens: tokensToUse,
            hasVoted: true
        });
        
        emit ProjectProposed(projectId, msg.sender, name, tokensToUse);
    }

    function voteForProject(uint projectId, uint tokensToUse) external {
        require(users[msg.sender].exists, "User not registered");
        require(projects[projectId].exists, "Project does not exist");
        require(!projects[projectId].completed, "Project already completed");
        require(!projects[projectId].votes[msg.sender].hasVoted, "Already voted");
        require(userTokenBalance[msg.sender] >= tokensToUse, "Insufficient tokens");

        Project storage project = projects[projectId];
        
        // Deduct tokens from voter
        userTokenBalance[msg.sender] -= tokensToUse;
        
        // Record the vote
        project.votes[msg.sender] = Vote({
            tokens: tokensToUse,
            hasVoted: true
        });
        
        // Update total votes
        project.totalVotes += tokensToUse;
        
        emit VoteCast(projectId, msg.sender, tokensToUse);
        
        // Check if project has reached threshold
        if (project.totalVotes >= VOTE_THRESHOLD && !project.completed) {
            completeProject(projectId);
        }
    }

    function completeProject(uint projectId) internal {
        Project storage project = projects[projectId];
        require(project.exists && !project.completed, "Invalid project or already completed");
        project.completed = true;
        project.totalStake = project.totalVotes;
        emit ProjectCompleted(projectId, project.proposer, project.totalVotes);
    }

    // New functions for community check phase

    /// @notice Initiates the community check phase for a completed project
    /// @param projectId The ID of the project to start community check for
    function initiateCommunityCommunityCheck(uint projectId) external {
        require(projects[projectId].exists, "Project does not exist");
        Project storage project = projects[projectId];
        require(msg.sender == project.proposer, "Only proposer can initiate");
        require(project.completed, "Project not completed");
        require(!project.communityCheck.initiated, "Community check already initiated");
        
        // Initialize community check structure
        project.communityCheck.initiated = true;
        project.communityCheck.currentRound = 1;
        project.communityCheck.totalRounds = COMMUNITY_CHECK_ROUNDS;
        project.communityCheck.completed = false;
        
        // Count total voters for calculating threshold
        uint voterCount = project.totalVotes;
        // This is a simplified version - you might want to optimize this
        project.communityCheck.voterCount = voterCount;
        project.communityCheck.requiredVotes = voterCount/2+1; // +1 for rounding up
        
        // Initialize first round
        project.communityCheck.rounds[1].startTime = block.timestamp;
        
        emit CommunityCheckInitiated(projectId, block.timestamp);
    }

    /// @notice Allows original voters to cast their vote in the current round
    /// @param projectId The ID of the project to vote on, 1 token = 1 vote
    function castRoundVote(uint projectId) external {
        require(projects[projectId].exists, "Project does not exist");

        Project storage project = projects[projectId];
        require(project.communityCheck.initiated, "Community check not initiated");
        require(!project.communityCheck.completed, "Community check completed");
        
        uint currentRound = project.communityCheck.currentRound;
        Round storage round = project.communityCheck.rounds[currentRound];
        require(block.timestamp < round.startTime + ROUND_DURATION, "Round ended");
        require(project.votes[msg.sender].hasVoted, "Not an original voter");
        require(!round.hasVoted[msg.sender][round.version], "Already voted in this round");
        
        round.hasVoted[msg.sender][round.version] = true;
        round.totalVotesCast += project.votes[msg.sender].tokens;

        emit RoundVoteCast(projectId, currentRound, msg.sender);

        if (round.totalVotesCast >= project.communityCheck.requiredVotes && !round.rewardDistributed) {
            completeRound(projectId);
        }
    }

    /// @notice Completes the current round and distributes rewards if threshold met
    /// @param projectId The ID of the project to complete round for
    function completeRound(uint projectId) internal {

        Project storage project = projects[projectId];

        uint currentRound = project.communityCheck.currentRound;
        Round storage round = project.communityCheck.rounds[currentRound];
        require(!round.completed, "Round already completed");
        
        round.completed = true;

        // Calculate and distribute reward
        uint rewardAmount = (project.totalVotes * REWARD_PERCENTAGE) / 100;
        if (currentRound == 10) {
            rewardAmount = project.totalStake;
        }

        project.totalStake -= rewardAmount;
        userTokenBalance[project.proposer] += rewardAmount;
        round.rewardDistributed = true;
        emit RewardDistributed(projectId, currentRound, rewardAmount);

        // Move to next round if not last
        if (currentRound < COMMUNITY_CHECK_ROUNDS) {
            project.communityCheck.currentRound++;
            project.communityCheck.rounds[currentRound + 1].startTime = block.timestamp;
        }
        else {
            project.communityCheck.completed = true;
            emit CommunityCheckCompleted(projectId, block.timestamp);
        }
        emit RoundCompleted(projectId, currentRound, round.rewardDistributed);
    }

    function restartRound(uint projectId) external {
        require(projects[projectId].exists, "Project does not exist");
        require(projects[projectId].proposer == msg.sender, "You must be the proposer to restart a round");

        Project storage project = projects[projectId];
        require(project.communityCheck.initiated, "Community check not initiated");
        require(!project.communityCheck.completed, "Community check already completed");
        
        uint currentRound = project.communityCheck.currentRound;
        Round storage round = project.communityCheck.rounds[currentRound];
        
        require(block.timestamp >= round.startTime + ROUND_DURATION, "Round period must have ended");
        round.version++;
        round.totalVotesCast = 0;
        round.completed = false;
        round.rewardDistributed = false;
        round.startTime = block.timestamp;

        emit RoundReset(projectId, currentRound, round.version, block.timestamp);
    }

    /// @notice Gets the details of a specific round
    /// @param projectId The ID of the project
    /// @param roundNumber The round number to get details for
    function getRoundDetails(uint projectId, uint roundNumber) external view returns (
        uint startTime,
        uint totalVotesCast,
        bool completed,
        bool rewardDistributed
    ) {
        require(projects[projectId].exists, "Project does not exist");
        require(roundNumber > 0 && roundNumber <= COMMUNITY_CHECK_ROUNDS, "Invalid round");
        
        Round storage round = projects[projectId].communityCheck.rounds[roundNumber];
        return (
            round.startTime,
            round.totalVotesCast,
            round.completed,
            round.rewardDistributed
        );
    }

    /// @notice Gets the overall status of the community check phase
    /// @param projectId The ID of the project
    function getCommunityCheckStatus(uint projectId) external view returns (
        bool initiated,
        uint round,
        uint requiredVotes,
        uint currentRoundVotes
    ) {
        Project storage project = projects[projectId];
        require(project.exists, "Project does not exist");
        
        CommunityCheck storage cc = project.communityCheck;
        Round storage currentRound = cc.rounds[cc.currentRound];
        
        return (
            cc.initiated,
            cc.currentRound,
            cc.requiredVotes,
            currentRound.totalVotesCast
        );
    }

    
    function getProjectDetails(uint projectId) external view returns (
        uint id,
        address proposer,
        string memory name,
        string memory pdfLink,
        uint initialTokens,
        uint totalVotes,
        bool exists,
        bool completed
    ) {
        require(projects[projectId].exists, "Project does not exist");
        Project storage project = projects[projectId];
        return (
            project.id,
            project.proposer,
            project.name,
            project.pdfLink,
            project.initialTokens,
            project.totalVotes,
            project.exists,
            project.completed
        );
    }
    
    function getVoteDetails(uint projectId, address voter) external view returns (uint tokens, bool hasVoted) {
        require(projects[projectId].exists, "Project does not exist");
        Vote storage vote = projects[projectId].votes[voter];
        return (vote.tokens, vote.hasVoted);
    }

    function getUserInfo(address userAddress) external view returns (
        string memory name,
        string memory email,
        uint amountDeposited,
        uint tokenBalance,
        bool exists
    ) {
        UserInfo storage user = users[userAddress];
        return (
            user.name,
            user.email,
            user.amountDeposited,
            userTokenBalance[userAddress],
            user.exists
        );
    }
    
    function getUserTokenBalance(address user) external view returns (uint) {
        return userTokenBalance[user];
    }

    function withdrawTokens(uint amount) external {
        require(users[msg.sender].exists, "User not registered");
        require(userTokenBalance[msg.sender] >= amount, "Insufficient token balance");
        require(amount > 0, "Amount must be greater than 0");

        // Calculate Ether amount based on token conversion rate
        uint etherAmount = amount * TOKENS_TO_WEI;

        // Check contract has enough Ether
        require(address(this).balance >= etherAmount, "Insufficient contract balance");

        // Update token balance before transfer to prevent reentrancy
        userTokenBalance[msg.sender] -= amount;

        // Transfer Ether to user
        (bool sent, ) = msg.sender.call{value: etherAmount}("");
        require(sent, "Failed to send Ether");

        emit TokensWithdrawn(msg.sender, amount, etherAmount);
    }
}
