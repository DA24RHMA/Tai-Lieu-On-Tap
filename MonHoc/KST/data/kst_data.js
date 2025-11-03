// --- BẮT ĐẦU FILE kst_data.js (File Đăng ký) ---

// 1. Thông tin môn học
const subjectInfo = {
    subjectId: "kst", // Mã định danh (giống tên thư mục)
    subjectName: "KST" // Tên hiển thị
};

// 2. Danh sách các Đề (CSV)
// Đây là nơi bạn "đăng ký" file CSV bạn đã cung cấp
const allDeckFiles = [
    { 
        id: 'Chuong1', // Mã định danh cho bộ đề (ngắn gọn)
        name: 'Chương 1 - Đại cương về ký sinh học - 326 câu', // Tên sẽ hiển thị trên nút bấm
        file: 'Chuong1.csv' // Tên file CSV tương ứng
    },
    { 
        id: 'chuong2-1', 
        name: 'Chương 2 - Tổng quan Đơn bào - 101 câu', 
        file: 'Chuong2-1.csv' 
    },
    { 
        id: 'chuong2-2', 
        name: 'Chương 2 - Trùng chân giả - 65 câu', 
        file: 'Chuong2-2.csv'
	},
	{ 
        id: 'chuong2-3', 
        name: 'Chương 2 - Trùng roi + lông - 139 câu', 
        file: 'Chuong2-3.csv'
	},
	{ 
        id: 'chuong2-4', 
        name: 'Chương 2 - Trùng bào tử - 7 câu', 
        file: 'Chuong2-4.csv'
	},
	{ 
        id: 'chuong2-5', 
        name: 'Chương 2 - Trùng sốt rét - 191 câu', 
        file: 'Chuong2-5.csv'
	},
];

// 3. Gán dữ liệu vào biến toàn cục (BẮT BUỘC)
window.SUBJECT_DATA = {
    info: subjectInfo,
    decks: allDeckFiles 
};


// --- KẾT THÚC FILE kst_data.js ---
