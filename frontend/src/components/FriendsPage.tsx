import { useState, useEffect } from "react";
import "./FriendsPage.css";

interface User {
  id: string;
  username: string; // discord_username
  avatar: string; // discord_avatar
}

interface Friend {
  friendship_id: number;
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
  status: string; // 'online' | 'offline' - currently mocked or could be from WS
}

interface SearchResult {
  id: string;
  username: string;
  nickname?: string;
  avatar?: string;
  elo: number;
}

export default function FriendsPage() {
  const [activeFriends, setActiveFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      fetchFriends(user.id);
    }
  }, []);

  const fetchFriends = async (userId: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/friends/${userId}`
      );
      if (res.ok) {
        const data = await res.json();
        setActiveFriends(data.friends || []);
        setPendingRequests(data.pendingIncoming || []);
        setPendingRequests(data.pendingIncoming || []);
      }
    } catch (err) {
      console.error("Failed to fetch friends", err);
      setError("Найзуудыг ачаалахад алдаа гарлаа");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !currentUser) return;

    setSearchLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/users/search?q=${searchQuery}&userId=${currentUser.id}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setSearchLoading(false);
    }
  };

  const sendFriendRequest = async (targetId: string) => {
    if (!currentUser) return;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/friends/request`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUser.id, targetId }),
        }
      );

      if (res.ok) {
        // Optimistic update or refresh? Refresh is safer.
        // Also remove from search results to indicate sent?
        setSearchResults((prev) => prev.filter((r) => r.id !== targetId));
        alert("Хүсэлт илгээлээ!");
        fetchFriends(currentUser.id);
      } else {
        const data = await res.json();
        alert(data.error || "Хүсэлт илгээхэд алдаа гарлаа");
      }
    } catch (err) {
      alert("Сүлжээний алдаа");
    }
  };

  const acceptRequest = async (requestId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/friends/accept`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId }),
        }
      );

      if (res.ok) {
        fetchFriends(currentUser.id);
      }
    } catch (err) {
      console.error("Accept failed", err);
    }
  };

  const declineRequest = async (requestId: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL || "http://localhost:8787"
        }/api/friends/${requestId}`,
        {
          method: "DELETE",
        }
      );

      if (res.ok) {
        fetchFriends(currentUser.id);
      }
    } catch (err) {
      console.error("Decline failed", err);
    }
  };

  const getAvatarUrl = (discordId: string, avatarHash?: string) => {
    if (!avatarHash) return null;
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png`;
  };

  return (
    <div className="friends-page">
      <h1 className="friends-page-title">ТОГЛОГЧДЫН СҮЛЖЭЭ</h1>
      {error && <div className="error-message">{error}</div>}

      <div className="friends-content">
        {/* LEFT COLUMN: ACTIVE FRIENDS */}
        <div className="active-friends-section">
          <h2 className="section-title">НАЙЗУУД ({activeFriends.length})</h2>

          {loading ? (
            <div className="loading-state">СҮЛЖЭЭГ ШАЛГАЖ БАЙНА...</div>
          ) : activeFriends.length === 0 ? (
            <div className="empty-state">ХАМТРАГЧ БАЙХГҮЙ</div>
          ) : (
            <div className="friends-list">
              {activeFriends.map((friend) => (
                <div key={friend.id} className="friend-item">
                  <div className="friend-info">
                    <div className="friend-avatar">
                      {friend.avatar ? (
                        <img
                          src={getAvatarUrl(friend.id, friend.avatar) || ""}
                          alt="avatar"
                        />
                      ) : (
                        <div className="avatar-placeholder">
                          {friend.username[0]}
                        </div>
                      )}
                    </div>
                    <div className="friend-details">
                      <div className="friend-name-status">
                        <span className="friend-name">
                          {friend.nickname || friend.username}
                        </span>
                      </div>
                      <span className="status-text online">● ОНЛАЙН</span>
                      <span className="friend-elo">ELO: {friend.elo}</span>
                    </div>
                  </div>
                  <div className="friend-actions">
                    <button className="message-btn">ЗУРВАС</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: SEARCH & REQUESTS */}
        <div className="right-column">
          {/* SEARCH SECTION */}
          <div className="add-friend-section">
            <h2 className="section-title">ТОГЛОГЧ УРИХ</h2>

            <div className="search-bar">
              <input
                type="text"
                placeholder="НЭРЭЭР ХАЙХ..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                className="search-btn"
                onClick={handleSearch}
                disabled={searchLoading}
              >
                {searchLoading ? "..." : "🔍"}
              </button>
            </div>

            <div className="search-results">
              {searchResults.map((result) => (
                <div key={result.id} className="result-item">
                  <div className="result-left">
                    <div className="result-avatar-small">
                      {result.avatar ? (
                        <img src={getAvatarUrl(result.id, result.avatar)!} />
                      ) : (
                        result.username[0]
                      )}
                    </div>
                    <div className="result-info">
                      <span className="result-name">
                        {result.nickname || result.username}
                      </span>
                      <span className="result-team">ELO: {result.elo}</span>
                    </div >
                  </div >
                  <div className="result-right">
                    <button
                      className="send-request-btn"
                      onClick={() => sendFriendRequest(result.id)}
                    >
                      НЭМЭХ +
                    </button>
                  </div>
                </div >
              ))
              }
              {
                searchResults.length === 0 && searchQuery && !searchLoading && (
                  <div className="no-results">МЭДЭЭЛЭЛ ОЛДОХГҮЙ</div>
                )
              }
            </div >
          </div >

          {/* REQESTS SECTION */}
          < div className="pending-requests-section" >
            <h2 className="section-title">
              ИРСЭН ХҮСЭЛТҮҮД ({pendingRequests.length})
            </h2>

            {
              pendingRequests.length === 0 ? (
                <div className="empty-state-small">
                  ХУЛЭЭГДЭЖ БАЙГАА ХҮСЭЛТ БАЙХГҮЙ
                </div>
              ) : (
                <div className="requests-list">
                  {pendingRequests.map((request) => (
                    <div key={request.id} className="request-item">
                      <div className="request-left">
                        <div className="request-avatar">
                          {request.avatar ? (
                            <img
                              src={getAvatarUrl(request.id, request.avatar)!}
                            />
                          ) : (
                            request.username[0]
                          )}
                        </div>
                        <div className="request-info">
                          <span className="request-name">
                            {request.nickname || request.username}
                          </span>
                          <div className="request-elo">
                            <span className="elo-label">ELO: {request.elo}</span>
                          </div>
                        </div>
                      </div>
                      <div className="request-actions">
                        <button
                          className="accept-btn"
                          onClick={() => acceptRequest(request.friendship_id)}
                        >
                          ЗӨВШӨӨРӨХ
                        </button>
                        <button
                          className="decline-btn"
                          onClick={() => declineRequest(request.friendship_id)}
                        >
                          ТАТГАЛАХ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </div >
        </div >
      </div >
    </div >
  );
}
