// 범용 Content Script - 모든 웹사이트에서 실행
(function() {
    'use strict';
    
    console.log('🚀 Content Script 실행됨:', window.location.href);
    
    // 🆕 페이지 방문 시작 시간 기록
    const visitStartTime = Date.now();
    console.log('⏰ 페이지 방문 시작 시간:', new Date(visitStartTime).toLocaleTimeString());
    
    // 페이지 로드 완료 후 실행
    function extractPageInfo() {
        console.log('📄 페이지 정보 추출 시작...');
        
        const pageInfo = {
            url: window.location.href,
            title: document.title,
            domain: window.location.hostname,
            timestamp: new Date().toISOString(),
            
            // 🆕 사용시간 정보 추가
            visitStartTime: visitStartTime,
            currentTime: Date.now(),
            
            // 🆕 페이지 유형
            pageType: detectPageType(),
            
            // 사이트별 특화 정보
            siteSpecific: extractSiteSpecificInfo()
        };
        
        console.log('📄 Content Script - 페이지 정보 추출:', pageInfo);
        
        // Background Script로 정보 전송
        chrome.runtime.sendMessage({
            action: 'pageInfo',
            data: pageInfo
        }, function(response) {
            console.log('📤 Background Script로 전송 완료:', response);
        });
    }
    
    // 🆕 페이지 떠날 때 사용시간 계산 및 전송
    function sendVisitDuration() {
        const visitEndTime = Date.now();
        const visitDuration = Math.floor((visitEndTime - visitStartTime) / 1000); // 초 단위
        
        console.log('⏰ 페이지 체류 시간:', visitDuration, '초');
        
        // Background Script로 체류 시간 전송
        chrome.runtime.sendMessage({
            action: 'visitDuration',
            data: {
                url: window.location.href,
                domain: window.location.hostname,
                visitStartTime: visitStartTime,
                visitEndTime: visitEndTime,
                duration: visitDuration
            }
        }, function(response) {
            console.log('📤 체류 시간 전송 완료:', response);
        });
    }
    
    // 🆕 페이지 유형 감지
    function detectPageType() {
        const domain = window.location.hostname;
        const path = window.location.pathname;
        
        if (domain.includes('youtube.com') && path.includes('/watch')) {
            return 'youtube_video';
        } else if (domain.includes('youtube.com')) {
            return 'youtube_page';
        } else if (domain.includes('naver.com') && path.includes('/news')) {
            return 'naver_news';
        } else if (domain.includes('google.com') && path.includes('/search')) {
            return 'google_search';
        } else if (domain.includes('google.com')) {
            return 'google_page';
        } else {
            return 'general_webpage';
        }
    }
    
    // 사이트별 특화 정보 추출 (간단하게)
    function extractSiteSpecificInfo() {
        const domain = window.location.hostname;
        const info = {};
        
        console.log('🔍 사이트별 정보 추출 시작, 도메인:', domain);
        
        // YouTube
        if (domain.includes('youtube.com')) {
            console.log('🎥 YouTube 페이지 감지');
            
            // 영상 제목 찾기
            const videoTitleSelectors = [
                'h1.ytd-video-primary-info-renderer',
                'h1.title',
                'h1.ytd-watch-metadata',
                'h1'
            ];
            
            for (let selector of videoTitleSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    info.videoTitle = element.textContent.trim();
                    console.log('✅ 영상 제목 찾음:', info.videoTitle);
                    break;
                }
            }
            
            // 채널명 찾기
            const channelSelectors = [
                '#channel-name a',
                '.ytd-channel-name a',
                '#owner-name a'
            ];
            
            for (let selector of channelSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    info.channelName = element.textContent.trim();
                    console.log('✅ 채널명 찾음:', info.channelName);
                    break;
                }
            }
            
            if (!info.videoTitle) {
                console.log('⚠️ 영상 제목을 찾을 수 없음');
            }
            if (!info.channelName) {
                console.log('⚠️ 채널명을 찾을 수 없음');
            }
        }
        
        // Naver
        else if (domain.includes('naver.com')) {
            console.log('📰 Naver 페이지 감지');
            const newsTitle = document.querySelector('.news_tit, .end_headline');
            const category = document.querySelector('.category, .news_category');
            
            if (newsTitle) info.newsTitle = newsTitle.textContent.trim();
            if (category) info.category = category.textContent.trim();
        }
        
        // Google
        else if (domain.includes('google.com')) {
            console.log('🔍 Google 페이지 감지');
            const searchQuery = document.querySelector('input[name="q"]');
            if (searchQuery) info.searchQuery = searchQuery.value;
        }
        
        console.log('🔍 추출된 사이트별 정보:', info);
        return info;
    }
    
    // 페이지 로드 완료 시 실행
    if (document.readyState === 'loading') {
        console.log('⏳ 페이지 로딩 중, DOMContentLoaded 대기...');
        document.addEventListener('DOMContentLoaded', extractPageInfo);
    } else {
        console.log('✅ 페이지 이미 로드됨, 즉시 실행');
        extractPageInfo();
    }
    
    // 🆕 페이지 떠날 때 이벤트 리스너 추가
    window.addEventListener('beforeunload', function() {
        console.log('🚪 페이지 떠남 감지');
        sendVisitDuration();
    });
    
    // 🆕 페이지 가시성 변경 감지 (탭 전환 시)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('👁️ 페이지 숨김 (탭 전환)');
            sendVisitDuration();
        }
    });
    
    // 페이지 변경 감지 (SPA 지원)
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            console.log('🔄 URL 변경 감지:', lastUrl, '→', url);
            // 🆕 이전 페이지 체류 시간 전송
            sendVisitDuration();
            lastUrl = url;
            setTimeout(extractPageInfo, 1000); // 1초 후 재실행
        }
    }).observe(document, {subtree: true, childList: true});
    
})(); 