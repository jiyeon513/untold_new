// front/src/components/widget/weatherWidget.tsx

import axiosInstance from '@/api/axiosInstance';
import React, { useState, useEffect } from 'react';
import { useScrap } from '@/hooks/useScrap';

interface WeatherData {
  name: string;
  weather: {
    description: string;
    icon: string;
    main: string;
  }[];
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
    pressure: number;
  };
  wind: {
    speed: number;
  };
  sys: {
    sunrise: number;
    sunset: number;
  };
  visibility: number;
}

export default function WeatherWidget() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 스크랩 기능 추가
  const scrapContent = weatherData ? 
    `${weatherData.name}: ${weatherData.weather[0]?.description}, ${Math.round(weatherData.main.temp)}°C` : 
    '';
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'weather', scrapContent);

  useEffect(() => {
    const fetchWeatherData = async () => {
      setIsLoading(true);  
      try {
        const response = await axiosInstance.get('/api/widgets/weather');
        setWeatherData(response.data);
      } catch (error) {
        console.error('날씨 정보를 가져오는 데 실패했습니다:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWeatherData();
  }, []);

  const getWeatherIcon = (weatherMain: string) => {
    const iconMap: { [key: string]: string } = {
      'Clear': '☀️',
      'Clouds': '☁️',
      'Rain': '🌧️',
      'Snow': '❄️',
      'Thunderstorm': '⛈️',
      'Drizzle': '🌦️',
      'Mist': '🌫️',
      'Fog': '🌫️',
      'Haze': '🌫️'
    };
    return iconMap[weatherMain] || '🌤️';
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
          <div className="h-8 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="grid grid-cols-2 gap-2">
          <div className="h-6 bg-gray-200 rounded"></div>
          <div className="h-6 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!weatherData || !weatherData.weather || !weatherData.weather[0]) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-2">🌤️</div>
        <p className="text-gray-500 text-sm">날씨 정보를 불러올 수 없어요</p>
      </div>
    );
  }

  const weather = weatherData.weather[0];
  const main = weatherData.main;

  return (
    <div className="space-y-4">
      {/* 스크랩 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={toggleScrap}
          disabled={scrapLoading || !weatherData}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
            isScrapped 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
          } ${scrapLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {scrapLoading ? '처리중...' : isScrapped ? '스크랩됨' : '스크랩하기'}
        </button>
      </div>

      {/* 메인 날씨 정보 */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-2">
          <span className="text-4xl">{getWeatherIcon(weather.main)}</span>
          <div>
            <div className="text-3xl font-bold text-gray-800">
              {Math.round(main.temp)}°C
            </div>
            <div className="text-sm text-gray-500">
              체감 {Math.round(main.feels_like)}°C
            </div>
          </div>
        </div>
        <p className="text-gray-700 font-medium">{weather.description}</p>
        <p className="text-sm text-gray-500">{weatherData.name}</p>
      </div>

      {/* 상세 정보 그리드 */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-blue-600 mb-1">💧 습도</div>
          <div className="font-semibold">{main.humidity}%</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-green-600 mb-1">💨 바람</div>
          <div className="font-semibold">{weatherData.wind.speed}m/s</div>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-orange-600 mb-1">🌅 일출</div>
          <div className="font-semibold">{formatTime(weatherData.sys.sunrise)}</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-purple-600 mb-1">🌇 일몰</div>
          <div className="font-semibold">{formatTime(weatherData.sys.sunset)}</div>
        </div>
      </div>

      {/* 가시거리 */}
      <div className="bg-gray-50 rounded-lg p-3 text-center">
        <div className="text-gray-600 mb-1">👁️ 가시거리</div>
        <div className="font-semibold">{(weatherData.visibility / 1000).toFixed(1)}km</div>
      </div>
    </div>
  );
}