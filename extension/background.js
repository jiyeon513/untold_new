// Background Script - URL 방문 감지 및 Content Script와 통신
chrome.webNavigation.onCompleted.addListener(function (details) {
    if (details.frameId !== 0) return; // 메인 프레임만 감지
    
    chrome.tabs.get(details.tabId, function (tab) {
        console.log("🌐 방문 감지:", {
            url: tab.url,
            title: tab.title,
            time: new Date().toLocaleTimeString(),
            domain: new URL(tab.url).hostname,
            tabId: tab.id,
            status: tab.status
        });
    });
});

// Content Script에서 받은 메시지 처리
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("📨 Content Script에서 메시지 수신:", request);
    
    if (request.action === 'pageInfo') {
        // 🆕 백엔드 연결 전에 콘솔에서 확인
        console.log("📄 Content Script - 페이지 정보 추출:", request.data);
        
        // 사이트별 정보 분석 (간단하게)
        analyzeSiteSpecificInfo(request.data);
        
        // 🆕 백엔드 서버로 전송 (활성화)
        sendToBackend(request.data);
    }
    
    // 🆕 사용시간 정보 처리
    else if (request.action === 'visitDuration') {
        console.log("⏰ 사용시간 정보 수신:", request.data);
        
        // 사용시간 정보를 백엔드로 전송
        sendDurationToBackend(request.data);
    }
});

// 🆕 사이트별 정보 분석 함수 (간단하게)
function analyzeSiteSpecificInfo(pageData) {
    const domain = pageData.domain;
    const siteSpecific = pageData.siteSpecific;
    
    console.log("🔍 사이트별 정보 분석:");
    console.log("  - 도메인:", domain);
    console.log("  - URL:", pageData.url);
    console.log("  - 제목:", pageData.title);
    console.log("  - 페이지 유형:", pageData.pageType);
    console.log("  - 방문 시작 시간:", new Date(pageData.visitStartTime).toLocaleTimeString());
    
    // 사이트별 특화 정보
    if (domain.includes('youtube.com')) {
        console.log("  - YouTube 영상 제목:", siteSpecific.videoTitle);
        console.log("  - 채널명:", siteSpecific.channelName);
    } else if (domain.includes('naver.com')) {
        console.log("  - 뉴스 제목:", siteSpecific.newsTitle);
        console.log("  - 카테고리:", siteSpecific.category);
    } else if (domain.includes('google.com')) {
        console.log("  - 검색어:", siteSpecific.searchQuery);
    }
    
    console.log("---");
}

// 🆕 백엔드 서버로 데이터 전송 (활성화)
async function sendToBackend(pageData) {
    try {
        console.log("📤 백엔드 서버로 데이터 전송 시작...");
        
        // 사용자 ID는 프론트엔드에서 전달받거나 기본값 사용
        let userId = pageData.user_id || null;
        
        const response = await fetch('http://localhost:8000/api/log_url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: pageData.url,
                title: pageData.title,
                domain: pageData.domain,
                timestamp: pageData.timestamp,
                pageType: pageData.pageType,
                siteSpecific: pageData.siteSpecific,
                visitStartTime: pageData.visitStartTime,
                currentTime: pageData.currentTime,
                user_id: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("✅ 백엔드 전송 성공:", result);
        
    } catch (error) {
        console.error("❌ 백엔드 전송 실패:", error);
        console.error("  - 에러 메시지:", error.message);
    }
}

// 🆕 사용시간 정보를 백엔드로 전송
async function sendDurationToBackend(durationData) {
    try {
        console.log("⏰ 사용시간 정보 백엔드 전송 시작...");
        
        const response = await fetch('http://localhost:8000/api/update_duration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: durationData.url,
                domain: durationData.domain,
                visitStartTime: durationData.visitStartTime,
                visitEndTime: durationData.visitEndTime,
                duration: durationData.duration
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log("✅ 사용시간 업데이트 성공:", result);
        
    } catch (error) {
        console.error("❌ 사용시간 업데이트 실패:", error);
        console.error("  - 에러 메시지:", error.message);
    }
}