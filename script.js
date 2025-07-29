// App state
let currentTab = 'stocks';
let currentFilter = 'all';
let assetsData = [];
let newsData = [];
let watchlist = JSON.parse(localStorage.getItem('financialDashboardWatchlist')) || [];
let currentAsset = null;
let marketChart, detailChart, comparisonChart;

// DOM Elements
const topPerformersEl = document.getElementById('topPerformers');
const fullRankingEl = document.getElementById('fullRanking');
const lastUpdatedEl = document.getElementById('updateTime');
const filterBtns = document.querySelectorAll('.filter-btn');
const tabs = document.querySelectorAll('.tab');
const assetCountEl = document.getElementById('assetCount');
const assetModal = document.getElementById('assetModal');
const closeModal = document.getElementById('closeModal');
const detailChartCtx = document.getElementById('detailChart').getContext('2d');
const newsGridEl = document.getElementById('newsGrid');
const allNewsGridEl = document.getElementById('allNewsGrid');
const allNewsModal = document.getElementById('allNewsModal');
const closeNewsModal = document.getElementById('closeNewsModal');
const viewAllNewsBtn = document.getElementById('viewAllNews');
const watchlistContainer = document.getElementById('watchlistContainer');
const watchlistContent = document.getElementById('watchlistContent');
const watchlistCount = document.getElementById('watchlistCount');
const addToWatchlistBtn = document.getElementById('addToWatchlist');
const openWatchlistModalBtn = document.getElementById('openWatchlistModal');
const watchlistModal = document.getElementById('watchlistModal');
const closeWatchlistModal = document.getElementById('closeWatchlistModal');
const watchlistModalContent = document.getElementById('watchlistModalContent');
const comparisonChartCtx = document.getElementById('comparisonChart').getContext('2d');
const timeBtns = document.querySelectorAll('.time-btn');

// Format currency
function formatCurrency(value) {
    return value >= 1 ?
        '$' + value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,') :
        '$' + value.toFixed(4);
}

// Format percentage
function formatPercentage(value) {
    return (value > 0 ? '+' : '') + value.toFixed(2) + '%';
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000000) {
        return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(2) + 'K';
    }
    return num;
}

// Generate asset element with company icons
function generateAssetElement(asset, index) {
    const changeClass = asset.change > 0 ? 'positive' : 'negative';
    const icon = asset.icon || (asset.type === 'crypto' ? 'fab fa-bitcoin' :
        asset.type === 'forex' ? 'fas fa-globe' :
        asset.type === 'commodity' ? 'fas fa-oil-well' : 'fas fa-chart-line');

    const isInWatchlist = watchlist.includes(asset.symbol);
    const watchlistIcon = isInWatchlist ? 'fas' : 'far';

    // Special icon for top performers
    const iconClass = index < 3 && document.getElementById('topPerformers').contains(document.activeElement) ?
        'asset-icon top-performer-icon' : 'asset-icon';

    return `
        <div class="asset-item" data-symbol="${asset.symbol}">
            <div class="${iconClass}">
                <i class="${icon}"></i>
            </div>
            <div class="asset-info">
                <div class="asset-name">${asset.name}</div>
                <div class="asset-symbol">${asset.symbol} | ${asset.type.charAt(0).toUpperCase() + asset.type.slice(1)}</div>
            </div>
            <div class="asset-price">${formatCurrency(asset.price)}</div>
            <div class="asset-change ${changeClass}">${formatPercentage(asset.change)}</div>
            <button class="watchlist-btn ${isInWatchlist ? 'active' : ''}" data-symbol="${asset.symbol}">
                <i class="${watchlistIcon} fa-star"></i>
            </button>
        </div>
    `;
}

// Generate news element
function generateNewsElement(article) {
    const publishedDate = new Date(article.publishedDate);
    const timeDiff = Math.floor((new Date() - publishedDate) / (1000 * 60));
    let timeAgo;

    if (timeDiff < 60) {
        timeAgo = `${timeDiff} minutes ago`;
    } else if (timeDiff < 1440) {
        timeAgo = `${Math.floor(timeDiff / 60)} hours ago`;
    } else {
        timeAgo = `${Math.floor(timeDiff / 1440)} days ago`;
    }

    return `
        <div class="news-card">
            <span class="news-source">${article.source}</span>
            <h3 class="news-title">${article.title}</h3>
            <p class="news-desc">${article.description}</p>
            <span class="news-date"><i class="far fa-clock"></i> ${timeAgo}</span>
        </div>
    `;
}

// Render assets
function renderAssets(assets, element) {
    if (assets.length === 0) {
        element.innerHTML = '<div class="error">No assets found for selected filter</div>';
        return;
    }

    element.innerHTML = assets.slice(0, 10).map((asset, index) =>
        generateAssetElement(asset, index)
    ).join('');

    // Add event listeners to asset items
    document.querySelectorAll('.asset-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.watchlist-btn')) {
                const symbol = item.getAttribute('data-symbol');
                openAssetModal(symbol);
            }
        });
    });

    // Add event listeners to watchlist buttons
    document.querySelectorAll('.watchlist-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const symbol = btn.getAttribute('data-symbol');
            toggleWatchlist(symbol);
        });
    });
}

// Render news
function renderNews(articles, element, limit = 2) {
    if (articles.length === 0) {
        element.innerHTML = '<div class="error">No news articles available</div>';
        return;
    }

    element.innerHTML = articles.slice(0, limit).map((article, index) =>
        generateNewsElement(article, index)
    ).join('');
}

// Render all news
function renderAllNews(articles, element) {
    if (articles.length === 0) {
        element.innerHTML = '<div class="error">No news articles available</div>';
        return;
    }

    element.innerHTML = articles.map((article, index) =>
        generateNewsElement(article, index)
    ).join('');
}

// Filter assets based on current filter
function filterAssets(assets) {
    switch (currentFilter) {
        case 'gainers':
            return assets.filter(a => a.change > 0)
                .sort((a, b) => b.change - a.change);
        case 'losers':
            return assets.filter(a => a.change < 0)
                .sort((a, b) => a.change - b.change);
        case 'active':
            return [...assets].sort((a, b) => (b.volume || 0) - (a.volume || 0));
        case 'all':
        default:
            return [...assets];
    }
}

// Update last updated timestamp
function updateTimestamp() {
    const now = new Date();
    lastUpdatedEl.textContent = `Last Updated: ${now.toLocaleTimeString()}`;
}

// Open asset detail modal
function openAssetModal(symbol) {
    currentAsset = [...assetsData]
        .find(a => a.symbol === symbol);

    if (currentAsset) {
        document.querySelector('.asset-detail-info h2').textContent = `${currentAsset.name} (${currentAsset.symbol})`;
        document.querySelector('.asset-detail-price').textContent = formatCurrency(currentAsset.price);

        const changeEl = document.querySelector('.detail-change');
        changeEl.textContent = formatPercentage(currentAsset.change);
        changeEl.className = `detail-change ${currentAsset.change > 0 ? 'positive' : 'negative'}`;

        // Update watchlist button
        const isInWatchlist = watchlist.includes(currentAsset.symbol);
        addToWatchlistBtn.innerHTML = isInWatchlist ?
            '<i class="fas fa-star"></i> Remove from Watchlist' :
            '<i class="fas fa-star"></i> Add to Watchlist';

        assetModal.style.display = 'flex';
    }
}

// Toggle asset in watchlist
function toggleWatchlist(symbol) {
    const index = watchlist.indexOf(symbol);

    if (index === -1) {
        watchlist.push(symbol);
    } else {
        watchlist.splice(index, 1);
    }

    // Save to localStorage
    localStorage.setItem('financialDashboardWatchlist', JSON.stringify(watchlist));

    // Re-render assets and watchlist
    renderAssets(assetsData, fullRankingEl);
    renderWatchlist();

    // Show notification
    const asset = assetsData.find(a => a.symbol === symbol);
    if (asset) {
        const action = index === -1 ? 'added to' : 'removed from';
        showNotification(`${asset.symbol} ${action} your watchlist`);
    }
}

// Render watchlist
function renderWatchlist() {
    if (watchlist.length === 0) {
        watchlistContent.innerHTML = `
            <div class="watchlist-empty">
                <i class="fas fa-star"></i>
                <h3>Your watchlist is empty</h3>
                <p>Add assets to your watchlist to track them here</p>
            </div>
        `;
        watchlistCount.textContent = '0 assets';
        return;
    }

    const watchlistItems = watchlist.map(symbol => {
        const asset = assetsData.find(a => a.symbol === symbol);
        if (!asset) return '';

        const changeClass = asset.change > 0 ? 'positive' : 'negative';
        const icon = asset.icon || (asset.type === 'crypto' ? 'fab fa-bitcoin' :
            asset.type === 'forex' ? 'fas fa-globe' :
            asset.type === 'commodity' ? 'fas fa-oil-well' : 'fas fa-chart-line');

        return `
            <div class="watchlist-item">
                <div class="watchlist-item-header">
                    <div class="watchlist-item-title">${asset.symbol}</div>
                    <div class="watchlist-remove" data-symbol="${asset.symbol}">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
                <div class="watchlist-item-price">${formatCurrency(asset.price)}</div>
                <div class="watchlist-item-change ${changeClass}">${formatPercentage(asset.change)}</div>
            </div>
        `;
    }).join('');

    watchlistContent.innerHTML = `
        <div class="watchlist-grid">
            ${watchlistItems}
        </div>
    `;

    watchlistCount.textContent = `${watchlist.length} ${watchlist.length === 1 ? 'asset' : 'assets'}`;

    // Add event listeners to remove buttons
    document.querySelectorAll('.watchlist-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const symbol = btn.getAttribute('data-symbol');
            toggleWatchlist(symbol);
        });
    });
}

// Render watchlist modal
function renderWatchlistModal() {
    if (watchlist.length === 0) {
        watchlistModalContent.innerHTML = `
            <div class="watchlist-empty">
                <i class="fas fa-star"></i>
                <h3>Your watchlist is empty</h3>
                <p>Add assets to your watchlist to track them here</p>
            </div>
        `;
        return;
    }

    const watchlistItems = watchlist.map(symbol => {
        const asset = assetsData.find(a => a.symbol === symbol);
        if (!asset) return '';

        const changeClass = asset.change > 0 ? 'positive' : 'negative';
        const icon = asset.icon || (asset.type === 'crypto' ? 'fab fa-bitcoin' :
            asset.type === 'forex' ? 'fas fa-globe' :
            asset.type === 'commodity' ? 'fas fa-oil-well' : 'fas fa-chart-line');

        return `
            <div class="watchlist-item">
                <div class="watchlist-item-header">
                    <div class="watchlist-item-title">${asset.name} (${asset.symbol})</div>
                    <div class="watchlist-remove" data-symbol="${asset.symbol}">
                        <i class="fas fa-times"></i>
                    </div>
                </div>
                <div class="watchlist-item-price">${formatCurrency(asset.price)}</div>
                <div class="watchlist-item-change ${changeClass}">${formatPercentage(asset.change)}</div>
            </div>
        `;
    }).join('');

    watchlistModalContent.innerHTML = `
        <div class="watchlist-grid">
            ${watchlistItems}
        </div>
    `;

    // Add event listeners to remove buttons
    document.querySelectorAll('.watchlist-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const symbol = btn.getAttribute('data-symbol');
            toggleWatchlist(symbol);
        });
    });
}

// Show notification
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Fetch assets from API
function fetchAssets() {
    return new Promise((resolve) => {
        // Simulate API call with sample data
        setTimeout(() => {
            const sampleAssets = {
                stocks: [{
                    symbol: "AAPL",
                    name: "Apple Inc.",
                    price: 189.25,
                    change: 2.34,
                    type: "stock",
                    volume: 50000000,
                    icon: "fab fa-apple"
                }, {
                    symbol: "MSFT",
                    name: "Microsoft Corp.",
                    price: 345.67,
                    change: 1.56,
                    type: "stock",
                    volume: 35000000,
                    icon: "fab fa-microsoft"
                }, {
                    symbol: "GOOGL",
                    name: "Alphabet Inc.",
                    price: 132.45,
                    change: 3.21,
                    type: "stock",
                    volume: 20000000,
                    icon: "fab fa-google"
                }, {
                    symbol: "AMZN",
                    name: "Amazon.com Inc.",
                    price: 138.45,
                    change: -0.87,
                    type: "stock",
                    volume: 40000000,
                    icon: "fab fa-amazon"
                }, {
                    symbol: "TSLA",
                    name: "Tesla Inc.",
                    price: 245.67,
                    change: 5.43,
                    type: "stock",
                    volume: 60000000,
                    icon: "fas fa-car"
                }, {
                    symbol: "META",
                    name: "Meta Platforms Inc.",
                    price: 298.76,
                    change: -1.23,
                    type: "stock",
                    volume: 30000000,
                    icon: "fab fa-facebook"
                }, {
                    symbol: "JPM",
                    name: "JPMorgan Chase & Co.",
                    price: 156.78,
                    change: 0.98,
                    type: "stock",
                    volume: 25000000,
                    icon: "fas fa-university"
                }, {
                    symbol: "V",
                    name: "Visa Inc.",
                    price: 245.32,
                    change: -0.56,
                    type: "stock",
                    volume: 15000000,
                    icon: "fab fa-cc-visa"
                }, {
                    symbol: "WMT",
                    name: "Walmart Inc.",
                    price: 163.45,
                    change: 1.23,
                    type: "stock",
                    volume: 18000000,
                    icon: "fas fa-shopping-cart"
                }, {
                    symbol: "JNJ",
                    name: "Johnson & Johnson",
                    price: 167.89,
                    change: -0.34,
                    type: "stock",
                    volume: 12000000,
                    icon: "fas fa-pills"
                }],
                crypto: [{
                    symbol: "BTC",
                    name: "Bitcoin",
                    price: 29356.78,
                    change: 1.87,
                    type: "crypto",
                    volume: 15000000000,
                    icon: "fab fa-bitcoin"
                }, {
                    symbol: "ETH",
                    name: "Ethereum",
                    price: 1856.32,
                    change: 3.21,
                    type: "crypto",
                    volume: 9000000000,
                    icon: "fab fa-ethereum"
                }, {
                    symbol: "BNB",
                    name: "Binance Coin",
                    price: 243.56,
                    change: -0.45,
                    type: "crypto",
                    volume: 500000000,
                    icon: "fas fa-coins"
                }, {
                    symbol: "XRP",
                    name: "Ripple",
                    price: 0.6234,
                    change: 5.32,
                    type: "crypto",
                    volume: 1200000000,
                    icon: "fas fa-bolt"
                }, {
                    symbol: "ADA",
                    name: "Cardano",
                    price: 0.3456,
                    change: -1.23,
                    type: "crypto",
                    volume: 400000000,
                    icon: "fas fa-leaf"
                }, {
                    symbol: "DOGE",
                    name: "Dogecoin",
                    price: 0.0789,
                    change: 12.34,
                    type: "crypto",
                    volume: 800000000,
                    icon: "fas fa-dog"
                }, {
                    symbol: "SOL",
                    name: "Solana",
                    price: 32.45,
                    change: 4.56,
                    type: "crypto",
                    volume: 700000000,
                    icon: "fas fa-fire"
                }, {
                    symbol: "DOT",
                    name: "Polkadot",
                    price: 5.67,
                    change: -2.34,
                    type: "crypto",
                    volume: 300000000,
                    icon: "fas fa-circle-nodes"
                }, {
                    symbol: "LTC",
                    name: "Litecoin",
                    price: 89.12,
                    change: 1.23,
                    type: "crypto",
                    volume: 450000000,
                    icon: "fab fa-bitcoin"
                }, {
                    symbol: "MATIC",
                    name: "Polygon",
                    price: 0.8765,
                    change: -0.98,
                    type: "crypto",
                    volume: 350000000,
                    icon: "fas fa-shapes"
                }],
                forex: [{
                    symbol: "EUR/USD",
                    name: "Euro / US Dollar",
                    price: 1.0925,
                    change: 0.12,
                    type: "forex",
                    volume: 5000000000,
                    icon: "fas fa-euro-sign"
                }, {
                    symbol: "USD/JPY",
                    name: "US Dollar / Japanese Yen",
                    price: 144.89,
                    change: -0.23,
                    type: "forex",
                    volume: 4000000000,
                    icon: "fas fa-yen-sign"
                }, {
                    symbol: "GBP/USD",
                    name: "British Pound / US Dollar",
                    price: 1.2765,
                    change: 0.34,
                    type: "forex",
                    volume: 3500000000,
                    icon: "fas fa-pound-sign"
                }, {
                    symbol: "USD/CHF",
                    name: "US Dollar / Swiss Franc",
                    price: 0.8789,
                    change: -0.15,
                    type: "forex",
                    volume: 2800000000,
                    icon: "fas fa-franc-sign"
                }, {
                    symbol: "AUD/USD",
                    name: "Australian Dollar / US Dollar",
                    price: 0.6623,
                    change: 0.27,
                    type: "forex",
                    volume: 2200000000,
                    icon: "fas fa-dollar-sign"
                }, {
                    symbol: "USD/CAD",
                    name: "US Dollar / Canadian Dollar",
                    price: 1.3189,
                    change: -0.18,
                    type: "forex",
                    volume: 1800000000,
                    icon: "fas fa-dollar-sign"
                }],
                commodities: [{
                    symbol: "GC",
                    name: "Gold",
                    price: 1945.67,
                    change: 0.45,
                    type: "commodity",
                    volume: 50000000,
                    icon: "fas fa-gem"
                }, {
                    symbol: "SI",
                    name: "Silver",
                    price: 23.45,
                    change: -0.32,
                    type: "commodity",
                    volume: 40000000,
                    icon: "fas fa-coins"
                }, {
                    symbol: "CL",
                    name: "Crude Oil",
                    price: 78.92,
                    change: 1.23,
                    type: "commodity",
                    volume: 60000000,
                    icon: "fas fa-gas-pump"
                }, {
                    symbol: "NG",
                    name: "Natural Gas",
                    price: 2.78,
                    change: -0.45,
                    type: "commodity",
                    volume: 35000000,
                    icon: "fas fa-fire"
                }]
            };

            // Apply filter to sample data
            const filtered = filterAssets(sampleAssets[currentTab]);
            resolve(filtered);
        }, 800);
    });
}

// Fetch news from API
function fetchNews() {
    return new Promise((resolve) => {
        // Simulate API call with sample data
        setTimeout(() => {
            // Generate news from the past week
            const sources = ["Bloomberg", "Financial Times", "Reuters", "CNBC", "Wall Street Journal", "CoinDesk"];
            const topics = [
                "Fed Signals Potential Rate Cuts Amid Cooling Inflation",
                "Tech Stocks Rally as AI Investments Surge",
                "Oil Prices Climb as OPEC+ Announces Production Cuts",
                "Cryptocurrency Market Sees Renewed Institutional Interest",
                "Global Supply Chains Stabilize After Years of Disruption",
                "Renewable Energy Investments Reach Record Highs",
                "Inflation Data Shows Signs of Cooling in Major Economies",
                "Major Bank Reports Strong Quarterly Earnings",
                "New Regulations Proposed for Crypto Exchanges",
                "Electric Vehicle Sales Exceed Expectations"
            ];

            const descriptions = [
                "The Federal Reserve indicates possible rate reductions later this year as inflation shows signs of easing.",
                "Major tech companies report increased revenue from AI services, driving sector growth.",
                "Global oil prices rise after OPEC+ countries agree to extend production cuts through Q3.",
                "Major financial institutions increase crypto investments despite regulatory uncertainty.",
                "Shipping and logistics networks return to pre-pandemic efficiency levels.",
                "Global investments in solar and wind power surpass fossil fuels for the first time.",
                "Consumer price index data shows inflation slowing in key markets including US and EU.",
                "One of the world's largest banks exceeds analyst expectations with strong Q2 results.",
                "Regulators propose new rules for cryptocurrency exchanges to enhance investor protection.",
                "Sales of electric vehicles surpass projections as consumer adoption accelerates."
            ];

            const recentNews = [];

            // Generate 20 news items from the past week
            for (let i = 0; i < 20; i++) {
                // Random date within the past week
                const daysAgo = Math.floor(Math.random() * 7);
                const hoursAgo = Math.floor(Math.random() * 24);
                const minutesAgo = Math.floor(Math.random() * 60);

                const publishedDate = new Date();
                publishedDate.setDate(publishedDate.getDate() - daysAgo);
                publishedDate.setHours(publishedDate.getHours() - hoursAgo);
                publishedDate.setMinutes(publishedDate.getMinutes() - minutesAgo);

                const source = sources[Math.floor(Math.random() * sources.length)];
                const topic = topics[Math.floor(Math.random() * topics.length)];
                const description = descriptions[Math.floor(Math.random() * descriptions.length)];

                recentNews.push({
                    title: topic,
                    description: description,
                    source: source,
                    publishedDate: publishedDate.toISOString()
                });
            }

            // Sort by most recent first
            recentNews.sort((a, b) =>
                new Date(b.publishedDate) - new Date(a.publishedDate)
            );

            resolve(recentNews);
        }, 800);
    });
}

// Initialize charts
function initCharts() {
    // Market Overview Chart
    const marketCtx = document.getElementById('marketChart').getContext('2d');
    marketChart = new Chart(marketCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
            datasets: [{
                label: 'S&P 500',
                data: [4100, 4200, 4150, 4300, 4400, 4350, 4500],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'NASDAQ',
                data: [12500, 13000, 12800, 13500, 14000, 14200, 14500],
                borderColor: '#4cc9f0',
                backgroundColor: 'rgba(76, 201, 240, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#8b949e'
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                }
            }
        }
    });

    // Detail chart (for modal)
    detailChart = new Chart(detailChartCtx, {
        type: 'line',
        data: {
            labels: ['1M', '2M', '3M', '4M', '5M', '6M'],
            datasets: [{
                label: 'Price History',
                data: [170, 175, 168, 180, 182, 189],
                borderColor: '#4361ee',
                backgroundColor: 'rgba(67, 97, 238, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                }
            }
        }
    });

    // Comparison chart
    comparisonChart = new Chart(comparisonChartCtx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Stocks',
                data: [12, 19, 3, 5, 2, 3],
                backgroundColor: '#4361ee',
            }, {
                label: 'Crypto',
                data: [2, 3, 5, 7, 6, 4],
                backgroundColor: '#4cc9f0',
            }, {
                label: 'Commodities',
                data: [3, 5, 7, 9, 4, 6],
                backgroundColor: '#2ec4b6',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#8b949e'
                    }
                }
            },
            scales: {
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)'
                    },
                    ticks: {
                        color: '#8b949e'
                    }
                }
            }
        }
    });
}

// Update charts based on time range
function updateCharts(range) {
    // This would normally fetch new data from API
    // For demo, we'll just update with random data
    const newData = Array.from({
        length: 7
    }, () => Math.random() * 1000 + 4000);

    marketChart.data.datasets[0].data = newData;
    marketChart.update();

    const detailData = Array.from({
        length: 6
    }, () => Math.random() * 50 + 150);
    detailChart.data.datasets[0].data = detailData;
    detailChart.update();

    // Update comparison chart
    const compData = Array.from({
        length: 6
    }, () => Math.floor(Math.random() * 10) + 1);
    const compData2 = Array.from({
        length: 6
    }, () => Math.floor(Math.random() * 10) + 1);
    const compData3 = Array.from({
        length: 6
    }, () => Math.floor(Math.random() * 10) + 1);

    comparisonChart.data.datasets[0].data = compData;
    comparisonChart.data.datasets[1].data = compData2;
    comparisonChart.data.datasets[2].data = compData3;
    comparisonChart.update();
}

// Process and render data
function processData() {
    // Update top performers (top 5 gainers)
    const topPerformers = [...assetsData]
        .sort((a, b) => b.change - a.change)
        .slice(0, 5);

    renderAssets(topPerformers, topPerformersEl);

    // Filter and render full ranking
    const filteredAssets = filterAssets(assetsData);
    renderAssets(filteredAssets, fullRankingEl);

    // Update asset count
    assetCountEl.textContent = `${filteredAssets.length} assets`;
}

// Load initial data
async function loadData() {
    // Fetch assets and news
    assetsData = await fetchAssets();
    newsData = await fetchNews();

    // Process and render data
    processData();
    renderNews(newsData, newsGridEl);

    // Set up news auto-refresh
    setInterval(async() => {
        newsData = await fetchNews();
        renderNews(newsData, newsGridEl);

        // Also update if all news modal is open
        if (allNewsModal.style.display === 'flex') {
            renderAllNews(newsData, allNewsGridEl);
        }
    }, 60000); // Refresh every 60 seconds
}

// Initialize the dashboard
function initDashboard() {
    initCharts();
    updateTimestamp();
    renderWatchlist();

    // Add event listeners to filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', async() => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.getAttribute('data-filter');

            // Show loading state
            topPerformersEl.innerHTML = `
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
            `;

            fullRankingEl.innerHTML = `
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
            `;

            // Fetch new data
            assetsData = await fetchAssets();
            processData();
        });
    });

    // Add event listeners to tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', async() => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            currentTab = tab.getAttribute('data-tab');

            // Show loading state
            topPerformersEl.innerHTML = `
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
            `;

            fullRankingEl.innerHTML = `
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
                <div class="asset-skeleton skeleton"></div>
            `;

            // Fetch new data
            assetsData = await fetchAssets();
            processData();
        });
    });

    // Time range buttons
    timeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const range = btn.getAttribute('data-range');
            updateCharts(range);
        });
    });

    // Modal close button
    closeModal.addEventListener('click', () => {
        assetModal.style.display = 'none';
    });

    // News modal close button
    closeNewsModal.addEventListener('click', () => {
        allNewsModal.style.display = 'none';
    });

    // View all news button
    viewAllNewsBtn.addEventListener('click', async(e) => {
        e.preventDefault();
        allNewsModal.style.display = 'flex';
        allNewsGridEl.innerHTML = '<div class="loader"><i class="fas fa-spinner"></i><p>Loading news articles...</p></div>';

        // Fetch news if not already loaded
        if (newsData.length === 0) {
            newsData = await fetchNews();
        }
        renderAllNews(newsData, allNewsGridEl);
    });

    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === assetModal) {
            assetModal.style.display = 'none';
        }
        if (e.target === allNewsModal) {
            allNewsModal.style.display = 'none';
        }
        if (e.target === watchlistModal) {
            watchlistModal.style.display = 'none';
        }
    });

    // Add to watchlist from modal
    addToWatchlistBtn.addEventListener('click', () => {
        if (currentAsset) {
            toggleWatchlist(currentAsset.symbol);
            assetModal.style.display = 'none';
        }
    });

    // Open watchlist modal
    openWatchlistModalBtn.addEventListener('click', () => {
        watchlistModal.style.display = 'flex';
        renderWatchlistModal();
    });

    // Close watchlist modal
    closeWatchlistModal.addEventListener('click', () => {
        watchlistModal.style.display = 'none';
    });

    // Update timestamp every minute
    setInterval(updateTimestamp, 60000);

    // Initialize with data
    loadData();
}

// Initialize when page loads
window.addEventListener('DOMContentLoaded', initDashboard);