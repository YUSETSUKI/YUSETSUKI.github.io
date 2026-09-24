let player;
let currentFood = "";
let currentRarity = "";
let currentYoutubeUrl = "";
let currentStartTime = 0;
let currentVideoId = "";
let progressInterval = null;

// ガチャボタンクリック処理
document.getElementById("gachaBtn").addEventListener("click", () => {
    Promise.all([
        fetch("movielist.txt").then(res => res.text()),
        fetch("Uwasa.txt").then(res => res.text())
    ]).then(([movieData, uwasaData]) => {
        // 1. 動画データのパースとランダム選定
        const movieLines = movieData.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const dataLines = movieLines.slice(1);
        const randomLine = dataLines[Math.floor(Math.random() * dataLines.length)];

        let parts = randomLine.split(/\t+/);
        let rawUrl = "";
        let seconds = "0";
        let rarity = "";
        let foodName = "";

        if (parts.length >= 5) {
            rawUrl = parts[1];
            seconds = parts[2];
            rarity = parts[3];
            foodName = parts.slice(4).join(" ");
        } else {
            parts = randomLine.split(/\s+/);
            rawUrl = parts[1];
            seconds = parts[2];
            if (["R", "SR", "SSR"].includes(parts[3])) {
                rarity = parts[3];
                foodName = parts.slice(4).join(" ");
            } else {
                rarity = "";
                foodName = parts.slice(3).join(" ");
            }
        }

        currentStartTime = parseInt(seconds || "0", 10);
        currentFood = foodName;
        currentRarity = rarity;
        currentVideoId = extractYouTubeID(rawUrl);
        currentYoutubeUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;

        // 2. Uwasa抽出
        const uwasaLines = uwasaData.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        const randomUwasa = uwasaLines[Math.floor(Math.random() * uwasaLines.length)];
        document.getElementById("uwasaText").textContent = randomUwasa;

        // 3. レア度に応じたタイマー設定
        let waitSeconds = 3;
        if (rarity === "R") {
            waitSeconds = 5;
        } else if (rarity === "SSR") {
            waitSeconds = 7;
        } else if (rarity === "SR") {
            waitSeconds = Math.random() < 0.5 ? 5 : 7;
        }

        // 4. UI初期化
        const overlay = document.getElementById("loadingOverlay");
        overlay.style.display = "flex";
        document.getElementById("placeholderText").style.display = "none";
        document.getElementById("resultArea").style.display = "none";
        document.getElementById("videoContainer").style.display = "none";

        if (progressInterval) {
            clearInterval(progressInterval);
        }

        const progressContainer = document.getElementById("progressContainer");

        // 5. タイマー処理（完了後すぐにモーダルを閉じ、サムネイルと持続光を表示）
        if (waitSeconds === 7) {
            const progressText = document.getElementById("progressText");
            const progressBarFill = document.getElementById("progressBarFill");

            progressText.textContent = "データ調整中 0％";
            progressBarFill.style.width = "0%";
            progressContainer.style.display = "block";

            const totalMs = waitSeconds * 1000;
            const intervalMs = 50;
            let elapsedTime = 0;

            progressInterval = setInterval(() => {
                elapsedTime += intervalMs;
                let percent = Math.floor((elapsedTime / totalMs) * 100);
                if (percent > 100) percent = 100;

                progressText.textContent = `データ調整中 ${percent}％`;
                progressBarFill.style.width = `${percent}%`;

                if (percent >= 100) {
                    clearInterval(progressInterval);
                    overlay.style.display = "none";
                    showThumbnailWithGlow(rarity);
                }
            }, intervalMs);
        } else {
            progressContainer.style.display = "none";
            setTimeout(() => {
                overlay.style.display = "none";
                showThumbnailWithGlow(rarity);
            }, waitSeconds * 1000);
        }
    }).catch(err => {
        console.error("データの読み込みに失敗しました:", err);
    });
});

// サムネイル表示と同時に強力な無限ループ発光を付与
function showThumbnailWithGlow(rarity) {
    if (!currentVideoId) {
        console.error("Video ID is missing");
        return;
    }

    const videoContainer = document.getElementById("videoContainer");
    videoContainer.className = ""; // クラスのリセット

    // 外側の要素（videoContainer）に発光クラスを付与
    if (rarity === "R") videoContainer.classList.add("flash-r");
    else if (rarity === "SR") videoContainer.classList.add("flash-sr");
    else if (rarity === "SSR") videoContainer.classList.add("flash-ssr");

    const thumbUrl = `https://img.youtube.com/vi/${currentVideoId}/hqdefault.jpg`;
    document.getElementById("videoThumb").src = thumbUrl;
    videoContainer.style.display = "block";
}

// サムネイルクリックでモーダル表示＆YouTube再生
document.getElementById("videoContainer").addEventListener("click", () => {
    document.getElementById("videoModal").style.display = "flex";

    setTimeout(() => {
        if (player && typeof player.loadVideoById === 'function') {
            player.loadVideoById({
                videoId: currentVideoId,
                startSeconds: currentStartTime
            });
        } else {
            player = new YT.Player('player', {
                height: '315',
                width: '560',
                videoId: currentVideoId,
                playerVars: {
                    'start': currentStartTime,
                    'autoplay': 1
                },
                events: {
                    'onStateChange': onPlayerStateChange
                }
            });
        }
    }, 10);
});

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        closeVideoModal();
    }
}

function closeVideoModal() {
    document.getElementById("videoModal").style.display = "none";
    if (player && typeof player.stopVideo === 'function') {
        player.stopVideo();
    }
    showResult();
}

document.getElementById("closeModal").addEventListener("click", closeVideoModal);

document.getElementById("videoModal").addEventListener("click", (e) => {
    if (e.target.id === "videoModal") {
        closeVideoModal();
    }
});

// 結果表示
function showResult() {
    document.getElementById("videoContainer").style.display = "block";

    let displayFood = currentFood;
    if (currentRarity) {
        displayFood = `＜${currentRarity}＞${currentFood}`;
    }

    document.getElementById("resultFoodText").textContent = `今日のラッキーフードは『${displayFood}』でした！`;
    document.getElementById("resultArea").style.display = "block";

    updateMapIframe(currentFood);

    let youtubeShareUrl = currentYoutubeUrl;
    if (currentStartTime > 0) {
        youtubeShareUrl += `&t=${currentStartTime}s`;
    }

    const shareText = `私のラッキーフードは『${displayFood}』でした！\n${youtubeShareUrl}\n\n↓↓ガチャのページはこちら！↓↓\nhttps://yrpportal.web.fc2.com/MHMHGC/index.html\n※非公式のファンサイトへ遷移します\n\n#雪城眞尋朝活アーカイブガチャ`;

    document.getElementById("shareXBtn").onclick = () => {
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
        window.open(twitterUrl, '_blank');
    };
}

function extractYouTubeID(url) {
    if (!url) return "";
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

// Mapの更新
function updateMapIframe(food) {
    const caption = document.getElementById("mapCaption");
    caption.textContent = `この周辺で『${food}』を食べられるお店は…`;

    const iframe = document.getElementById("mapIframe");
    const query = encodeURIComponent(`この周辺の『${food}』`);
    iframe.src = `https://maps.google.com/maps?q=${query}&output=embed&z=14`;
}