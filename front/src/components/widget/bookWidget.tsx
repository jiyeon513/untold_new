import React, { useState, useEffect } from 'react';
import axiosInstance from '../../api/axiosInstance';
import { useScrap } from '@/hooks/useScrap';

interface Book {
  title: string;
  link: string;
  cover: string;
  author: string;
}

// 개별 책 스크랩 버튼 컴포넌트
const BookScrapButton = ({ book }: { book: Book }) => {
  const scrapContent = `${book.title} - ${book.author}`;
  const { isScrapped, isLoading: scrapLoading, toggleScrap } = useScrap('widget', 'book', scrapContent);

  return (
    <button
      onClick={toggleScrap}
      disabled={scrapLoading}
      className={`px-2 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
        isScrapped 
          ? 'bg-green-100 text-green-700 border border-green-200' 
          : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
      } ${scrapLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {scrapLoading ? '처리중...' : isScrapped ? '스크랩됨' : '스크랩'}
    </button>
  );
};

export default function BookWidget() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get('/api/widgets/book');
        if (response.data && Array.isArray(response.data.item)) {
          setBooks(response.data.item);
        }
      } catch (error) {
        console.error('책 정보를 가져오는 데 실패했습니다:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <>
      {isLoading ? (
        <p className="text-gray-500">책 정보를 불러오는 중...</p>
      ) : books.length > 0 ? (
        <div className="space-y-3">
          {books.map((book, index) => (
            <div key={index} className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <a 
                href={book.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-3 flex-1"
              >
                <img src={book.cover} alt={book.title} className="w-10 h-14 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 break-words whitespace-normal">
                    {book.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{book.author}</p>
                </div>
              </a>
              <BookScrapButton book={book} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">책 정보를 불러올 수 없어요.</p>
      )}
    </>
  );
}