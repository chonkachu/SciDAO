import React, { useState, useEffect } from 'react';
import { BrowserProvider, Contract, formatEther, parseEther } from 'ethers';
import { AlertCircle, Wallet, LogOut } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import DAO_ABI from '../contract/abi.json';

const DAO_ADDRESS = "0x6722169CF3259678D79C95673B390d318d3f0E90";
const TOKENS_TO_WEI = BigInt("1000000000000"); // 1000 Gwei (1 token = 1000 Gwei from contract)

export default function DAOApp() {
  const [provider, setProvider] = useState(null);
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [communityCheckStatus, setCommunityCheckStatus] = useState(null);
  const [roundDetails, setRoundDetails] = useState(null);
  const [voteDetails, setVoteDetails] = useState(null);

  const tokensToWei = (tokens) => {
    return BigInt(Math.floor(tokens)) * TOKENS_TO_WEI;
  };

  // Convert wei to tokens for display
  const weiToTokens = (wei) => {
    return Number(wei) / Number(TOKENS_TO_WEI);
  };
  const handleLogout = () => {
    setProvider(null);
    setContract(null);
    setAccount(null);
    setUserInfo(null);
    setProjects([]);
    setError(null);
  };
  // Connect to MetaMask
  const connectWallet = async () => {
    try {
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const account = await signer.getAddress();
        const contract = new Contract(DAO_ADDRESS, DAO_ABI, signer);

        await loadUserInfo(account, contract);
        setProvider(provider);
        setContract(contract);
        setAccount(account);
        console.log("CONNECTED!");
        console.log(account);

        // Load user info if exists
      }
    } catch (err) {
      setError('Failed to connect wallet: ' + err.message);
    }
  };

  // Load user information
  const loadUserInfo = async (address, contract) => {
    try {
      const info = await contract.getUserInfo(address);
      setUserInfo({
        name: info[0],
        email: info[1],
        deposited: formatEther(info[2]),
        tokens: info[3].toString(),
        exists: info[4],
        address: address
      });
    } catch (err) {
      setError('Failed to load user info: ' + err.message);
    }
  };

  // Load projects
  const loadProjects = async () => {
    try {
      const nextId = await contract.nextProjectId();
      const projectsData = [];

      for (let i = 0; i < nextId; i++) {
        const project = await contract.getProjectDetails(i);
        if (project[6]) { // exists
          projectsData.push({
            id: i,
            proposer: project[1],
            name: project[2],
            pdfLink: project[3],
            initialTokens: project[4].toString(),
            totalVotes: project[5].toString(),
            exists: project[6],
            completed: project[7]
          });
        }
      }

      setProjects(projectsData);
    } catch (err) {
      setError('Failed to load projects: ' + err.message);
    }
  };

const loadCommunityCheckStatus = async (projectId) => {
  try {
    const status = await contract.getCommunityCheckStatus(projectId);
    setCommunityCheckStatus({
      initiated: status[0],
      currentRound: status[1].toString(),
      requiredVotes: status[2].toString(),
      currentRoundVotes: status[3].toString()
    });

    if (status[0]) { // if initiated
      const round = await contract.getRoundDetails(projectId, status[1]);
      setRoundDetails({
        startTime: new Date(Number(round[0]) * 1000),
        totalVotesCast: round[1].toString(),
        completed: round[2],
        rewardDistributed: round[3]
      });
      const vote = await contract.getVoteDetails(projectId, account);
      setVoteDetails({
        tokens: vote[0],
        hasVoted: vote[1]
      });
    }
  } catch (err) {
    setError('Failed to load community check status: ' + err.message);
  }
};
  // Register Form Component
  const RegisterForm = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [tokens, setTokens] = useState('');

    const handleRegister = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        console.log(Math.floor(tokens));
        const weiValue = tokensToWei(tokens);
        const tx = await contract.registerUser(
          name,
          email,
          { value: weiValue }
        );
        await tx.wait();
        await loadUserInfo(account, contract);
      } catch (err) {
        setError('Registration failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-3 border rounded-lg bg-gray-50"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 border rounded-lg bg-gray-50"
        />
        <input
          type="number"
          step="1"
          min="1"
          placeholder="Tokens to Purchase"
          value={tokens}
          onChange={(e) => setTokens(e.target.value)}
          className="w-full p-3 border rounded-lg bg-gray-50"
        />
        <p className="text-sm text-gray-600">
          Cost: {tokens ? formatEther(tokensToWei(tokens).toString()) : '0'} ETH
        </p>
        <button
          type="submit"
          disabled={loading}
          className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
    );
  };

const RoundVoting = ({ project }) => {
  const handleInitiateCommunityCheck = async () => {
    try {
      setLoading(true);
      const tx = await contract.initiateCommunityCommunityCheck(project.id);
      await tx.wait();
      await loadCommunityCheckStatus(project.id);
    } catch (err) {
      setError('Failed to initiate community check: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoundVote = async () => {
    try {
      setLoading(true);
      const tx = await contract.castRoundVote(project.id);
      await tx.wait();
      await loadCommunityCheckStatus(project.id);
    } catch (err) {
      setError('Failed to cast round vote: User Already voted!');
    } finally {
      setLoading(false);
    }
  };

  const handleRestartRound = async () => {
    try {
      setLoading(true);
      const tx = await contract.restartRound(project.id);
      await tx.wait();
      await loadCommunityCheckStatus(project.id);
    } catch (err) {
      setError('Failed to restart round: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const now = Date.now();
  const roundEndTime = roundDetails?.startTime?.getTime() + (7 * 24 * 60 * 60 * 1000); // 7 days
  const roundEnded = roundEndTime && now > roundEndTime;
  const canVote = communityCheckStatus?.initiated && roundDetails && !roundDetails.completed && !roundEnded && voteDetails?.hasVoted;
  const canRestart = roundEnded && !roundDetails?.completed && project.proposer === userInfo.address;

  // If project is not completed yet, don't show community check
  if (!project.completed) {
    return (
      <div className="mt-4 text-center text-gray-600">
        Project voting needs to be completed before starting community check.
      </div>
    );
  }

  // If community check not initiated
  if (!communityCheckStatus?.initiated) {
    return (
      <div className="mt-4 space-y-4">
        <div className="text-center text-gray-600">
          Community check has not been initiated yet.
        </div>
        {project.proposer === userInfo.address && (
          <button
            onClick={handleInitiateCommunityCheck}
            disabled={loading}
            className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
          >
            Start Community Check
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded-lg">
      <div className="text-center space-y-2">
        <h4 className="font-semibold text-lg">Community Check Phase</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-2 rounded shadow-sm">
            <p className="font-medium">Current Round</p>
            <p className="text-blue-600">{communityCheckStatus.currentRound} / 10</p>
          </div>
          <div className="bg-white p-2 rounded shadow-sm">
            <p className="font-medium">Votes Progress</p>
            <p className="text-blue-600">
              {communityCheckStatus.currentRoundVotes} / {communityCheckStatus.requiredVotes}
            </p>
          </div>
          {roundDetails && (
            <>
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="font-medium">Round Status</p>
                <p className={roundDetails.completed ? "text-green-600" : "text-yellow-600"}>
                  {roundDetails.completed ? 'Completed' : 'In Progress'}
                </p>
              </div>
              <div className="bg-white p-2 rounded shadow-sm">
                <p className="font-medium">Round Ends</p>
                <p className={roundEnded ? "text-red-600" : "text-green-600"}>
                  {new Date(roundEndTime).toLocaleDateString()}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {canVote && (
          <button
            onClick={handleRoundVote}
            disabled={loading}
            className="w-full p-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            Cast Round Vote
          </button>
        )}
        
        {canRestart && (
          <button
            onClick={handleRestartRound}
            disabled={loading}
            className="w-full p-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:bg-yellow-300"
          >
            Restart Round
          </button>
        )}
      </div>
    </div>
  );
};
  // Project Form Component
  const ProjectForm = () => {
    const [name, setName] = useState('');
    const [pdfLink, setPdfLink] = useState('');
    const [tokens, setTokens] = useState('');

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const tx = await contract.proposeProject(name, pdfLink, tokens);
        await tx.wait();
        await loadProjects();
        await loadUserInfo();
      } catch (err) {
        setError('Failed to create project: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Project Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="text"
          placeholder="PDF Link"
          value={pdfLink}
          onChange={(e) => setPdfLink(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="number"
          placeholder="Tokens to Use"
          value={tokens}
          onChange={(e) => setTokens(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full p-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-green-300"
        >
          {loading ? 'Creating...' : 'Create Project'}
        </button>
      </form>
    );
  };

  // Token Management Component
  const TokenManagement = () => {
    const [depositTokens, setDepositTokens] = useState('');
    const [withdrawTokens, setWithdrawTokens] = useState('');

    const handleDeposit = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const weiValue = tokensToWei(depositTokens);
        const tx = await contract.depositTokens({
          value: weiValue
        });
        await tx.wait();
        await loadUserInfo(account, contract);
      } catch (err) {
        setError('Deposit failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    const handleWithdraw = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const tx = await contract.withdrawTokens(withdrawTokens);
        await tx.wait();
        await loadUserInfo(account, contract);
      } catch (err) {
        setError('Withdrawal failed: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <form onSubmit={handleDeposit} className="space-y-4">
          <input
            type="number"
            step="1"
            min="1"
            placeholder="Tokens to Purchase"
            value={depositTokens}
            onChange={(e) => setDepositTokens(e.target.value)}
            className="w-full p-3 border rounded-lg bg-gray-50"
          />
          <p className="text-sm text-gray-600">
            Cost: {depositTokens ? formatEther(tokensToWei(depositTokens).toString()) : '0'} ETH
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
          >
            Purchase Tokens
          </button>
        </form>

        <form onSubmit={handleWithdraw} className="space-y-4">
          <input
            type="number"
            step="1"
            min="1"
            placeholder="Tokens to Withdraw"
            value={withdrawTokens}
            onChange={(e) => setWithdrawTokens(e.target.value)}
            className="w-full p-3 border rounded-lg bg-gray-50"
          />
          <p className="text-sm text-gray-600">
            Will receive: {withdrawTokens ? formatEther(tokensToWei(withdrawTokens).toString()) : '0'} ETH
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full p-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-red-300 transition-colors"
          >
            Withdraw Tokens
          </button>
        </form>
      </div>
    );
  };

// Project List Component
const ProjectList = () => {
  const [voteAmount, setVoteAmount] = useState({});

  const handleProjectClick = async (project) => {
    if (selectedProject === project.id) {
      setSelectedProject(null);
      setCommunityCheckStatus(null);
      setRoundDetails(null);
    } else {
      setSelectedProject(null);
      await loadCommunityCheckStatus(project.id);
      setSelectedProject(project.id);
    }
  };

  const handleVote = async (projectId) => {
    try {
      setLoading(true);
      const tx = await contract.voteForProject(projectId, voteAmount[projectId]);
      await tx.wait();
      await loadProjects();
      await loadUserInfo(account, contract);
    } catch (err) {
      setError('Voting failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {projects.map(project => (
        <div 
          key={project.id} 
          className={`p-4 border rounded shadow-sm cursor-pointer transition-colors ${
            selectedProject === project.id ? 'border-blue-500' : 'hover:border-gray-300'
          }`}
          onClick={() => handleProjectClick(project)}
        >
          <h3 className="font-bold text-lg text-center">{project.name}</h3>
          <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
            <p><span className="font-medium">Status:</span> {project.completed ? 'Funded' : 'Open for funding'}</p>
            <p><span className="font-medium">Total Votes:</span> {project.totalVotes}</p>
            <p className="text-gray-600">
              <span className="font-medium">Proposer:</span> {project.proposer.substring(0, 6)}...{project.proposer.substring(38)}
            </p>
            <p><span className="font-medium">Initial Tokens:</span> {project.initialTokens}</p>
          </div>
          <div className="mt-2 text-center">
            <a 
              href={project.pdfLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              View PDF
            </a>
          </div>

          {/* Show community check interface if selected */}
          {selectedProject === project.id && (
            <RoundVoting project={project} />
          )}

          {/* Show voting interface only if project is not completed and user is not the proposer */}
          {!project.completed && project.proposer !== userInfo.address && (
            <div className="mt-4 space-y-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="number"
                placeholder="Tokens to Vote"
                value={voteAmount[project.id] || ''}
                onChange={(e) => setVoteAmount({
                  ...voteAmount,
                  [project.id]: e.target.value
                })}
                className="w-full p-2 border rounded"
              />
              <button
                onClick={() => handleVote(project.id)}
                disabled={loading}
                className="w-full p-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-purple-300"
              >
                Vote
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

useEffect(() => {
  if (contract) {
    loadProjects();
  }
}, [contract]);

return (
  <div className="min-h-screen bg-gray-50 flex justify-center">
    <div className="w-full max-w-[1400px] px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">DAO DApp</h1>
          {account && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-gray-100 rounded hover:bg-gray-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          )}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!account ? (
          <div className="flex flex-col items-center justify-center py-12">
            <button
              onClick={connectWallet}
              className="p-4 bg-blue-500 text-white rounded-lg flex items-center gap-2 hover:bg-blue-600 transition-colors"
            >
              <Wallet className="h-5 w-5" />
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {!userInfo?.exists ? (
              <div className="bg-white rounded-lg">
                <h2 className="text-xl font-bold mb-4">Register User</h2>
                <RegisterForm />
              </div>
            ) : (
              <div className="flex gap-6">

                {/* Other Components - Right Side */}
                <div className="w-1/2 space-y-6">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h2 className="text-xl font-bold mb-4">User Info</h2>
                    <div className="grid grid-cols-1 gap-4">
                      <div><span className="font-medium">Name:</span> {userInfo.name}</div>
                      <div><span className="font-medium">Email:</span> {userInfo.email}</div>
                      <div><span className="font-medium">Deposited ETH:</span> {userInfo.deposited}</div>
                      <div><span className="font-medium">Token Balance:</span> {userInfo.tokens}</div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border">
                    <div className="p-6">
                      <h2 className="text-xl font-bold mb-4">Token Management</h2>
                      <TokenManagement />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border">
                    <div className="p-6">
                      <h2 className="text-xl font-bold mb-4">Create Project</h2>
                      <ProjectForm />
                    </div>
                  </div>
                </div>

                {/* Projects Section - Left Side */}
                <div className="w-1/2 bg-white rounded-lg border">
                  <div className="p-6">
                    <h2 className="text-xl font-bold mb-4">Projects</h2>
                    <ProjectList />
                  </div>
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  </div>
);
}
