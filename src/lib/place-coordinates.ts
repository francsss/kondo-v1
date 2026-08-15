/**
 * Published coordinates for the places Kondo students study in.
 *
 * These are institutions and city centres, taken from their public locations —
 * not people. Nearby needs a real number behind "5 km away", and the honest
 * unit for a student network is the distance between two campuses, not a
 * device reading Kondo never takes.
 *
 * The list is deliberately partial. A city or university that is not here
 * simply has no coordinates, and Nearby shows no distance for it rather than a
 * guessed one. Adding entries is the way to widen coverage.
 */

export type PlacePoint = { latitude: number; longitude: number };

/** City centres, keyed by the city name as stored in `City.name`. */
export const CITY_COORDINATES: Record<string, PlacePoint> = {
  Beijing: { latitude: 39.9042, longitude: 116.4074 },
  Shanghai: { latitude: 31.2304, longitude: 121.4737 },
  Guangzhou: { latitude: 23.1291, longitude: 113.2644 },
  Shenzhen: { latitude: 22.5431, longitude: 114.0579 },
  Tianjin: { latitude: 39.3434, longitude: 117.3616 },
  Chongqing: { latitude: 29.563, longitude: 106.5516 },
  Wuhan: { latitude: 30.5928, longitude: 114.3055 },
  Hangzhou: { latitude: 30.2741, longitude: 120.1551 },
  Nanjing: { latitude: 32.0603, longitude: 118.7969 },
  "Xi'an": { latitude: 34.3416, longitude: 108.9398 },
  Xian: { latitude: 34.3416, longitude: 108.9398 },
  Chengdu: { latitude: 30.5728, longitude: 104.0668 },
  Jiaxing: { latitude: 30.7522, longitude: 120.75 },
  Harbin: { latitude: 45.8038, longitude: 126.535 },
  Suzhou: { latitude: 31.2989, longitude: 120.5853 },
  Qingdao: { latitude: 36.0671, longitude: 120.3826 },
  Dalian: { latitude: 38.914, longitude: 121.6147 },
  Xiamen: { latitude: 24.4798, longitude: 118.0894 },
  Kunming: { latitude: 25.0389, longitude: 102.7183 },
  Changsha: { latitude: 28.2282, longitude: 112.9388 },
  Zhengzhou: { latitude: 34.7466, longitude: 113.6254 },
  Shenyang: { latitude: 41.8057, longitude: 123.4315 },
  Jinan: { latitude: 36.6512, longitude: 117.1201 },
  Hefei: { latitude: 31.8206, longitude: 117.2272 },
  Fuzhou: { latitude: 26.0745, longitude: 119.2965 },
  Nanchang: { latitude: 28.682, longitude: 115.8579 },
  Guiyang: { latitude: 26.647, longitude: 106.6302 },
  Lanzhou: { latitude: 36.0611, longitude: 103.8343 },
  Urumqi: { latitude: 43.8256, longitude: 87.6168 },
  Nanning: { latitude: 22.817, longitude: 108.3665 },
  Shijiazhuang: { latitude: 38.0428, longitude: 114.5149 },
  Taiyuan: { latitude: 37.8706, longitude: 112.5489 },
  Changchun: { latitude: 43.8171, longitude: 125.3235 },
  Wenzhou: { latitude: 27.9938, longitude: 120.6994 },
  Ningbo: { latitude: 29.8683, longitude: 121.544 },
  Wuxi: { latitude: 31.4912, longitude: 120.3119 },
  Foshan: { latitude: 23.0219, longitude: 113.1214 },
  Dongguan: { latitude: 23.0207, longitude: 113.7518 },
  Zhuhai: { latitude: 22.271, longitude: 113.5767 },
  Sanya: { latitude: 18.2528, longitude: 109.5119 },
  Haikou: { latitude: 20.0444, longitude: 110.1999 },
  Lhasa: { latitude: 29.652, longitude: 91.1721 },
  Yinchuan: { latitude: 38.4872, longitude: 106.2309 },
  Xining: { latitude: 36.6171, longitude: 101.7782 },
  Hohhot: { latitude: 40.8414, longitude: 111.7519 },
};

/**
 * Campus coordinates, keyed by the university name as stored in
 * `University.name`. These matter more than city centres: Nearby is usually
 * scoped to one city, where every city centroid would be identical and every
 * row would read the same distance. Campuses are genuinely kilometres apart.
 */
export const UNIVERSITY_COORDINATES: Record<string, PlacePoint> = {
  "Peking University": { latitude: 39.999, longitude: 116.3059 },
  "Tsinghua University": { latitude: 40.0, longitude: 116.3264 },
  "Renmin University of China": { latitude: 39.9707, longitude: 116.3157 },
  "Beihang University": { latitude: 39.9807, longitude: 116.3475 },
  "Beijing Normal University": { latitude: 39.9618, longitude: 116.3656 },
  "Beijing Institute of Technology": { latitude: 39.9614, longitude: 116.3164 },
  "China Agricultural University": { latitude: 40.0053, longitude: 116.3452 },
  "Beijing Language and Culture University": {
    latitude: 39.9758,
    longitude: 116.3455,
  },
  "University of International Business and Economics": {
    latitude: 39.9906,
    longitude: 116.4247,
  },
  "Communication University of China": {
    latitude: 39.9058,
    longitude: 116.5568,
  },
  "Fudan University": { latitude: 31.2989, longitude: 121.5035 },
  "Shanghai Jiao Tong University": { latitude: 31.2016, longitude: 121.4269 },
  "Tongji University": { latitude: 31.2837, longitude: 121.5017 },
  "East China Normal University": { latitude: 31.2276, longitude: 121.4074 },
  "Shanghai University": { latitude: 31.3168, longitude: 121.3924 },
  "Zhejiang University": { latitude: 30.2649, longitude: 120.125 },
  "Wuhan University": { latitude: 30.541, longitude: 114.362 },
  "Huazhong University of Science and Technology": {
    latitude: 30.5122,
    longitude: 114.4128,
  },
  "Nanjing University": { latitude: 32.0555, longitude: 118.7788 },
  "Southeast University": { latitude: 32.0562, longitude: 118.7869 },
  "Sun Yat-sen University": { latitude: 23.0967, longitude: 113.2986 },
  "South China University of Technology": {
    latitude: 23.1523,
    longitude: 113.3444,
  },
  "Xi'an Jiaotong University": { latitude: 34.2451, longitude: 108.9846 },
  "Northwestern Polytechnical University": {
    latitude: 34.2461,
    longitude: 108.9138,
  },
  "Sichuan University": { latitude: 30.6303, longitude: 104.0817 },
  "University of Electronic Science and Technology of China": {
    latitude: 30.7539,
    longitude: 103.9345,
  },
  "Harbin Institute of Technology": { latitude: 45.7477, longitude: 126.6398 },
  "Xiamen University": { latitude: 24.4364, longitude: 118.0949 },
  "Shandong University": { latitude: 36.6749, longitude: 117.0576 },
  "Tianjin University": { latitude: 39.1088, longitude: 117.1687 },
  "Nankai University": { latitude: 39.1064, longitude: 117.1651 },
  "Jilin University": { latitude: 43.8558, longitude: 125.2938 },
  "Dalian University of Technology": { latitude: 38.8814, longitude: 121.5271 },
  "Central South University": { latitude: 28.1683, longitude: 112.9354 },
  "Hunan University": { latitude: 28.1806, longitude: 112.9455 },
  "Chongqing University": { latitude: 29.5657, longitude: 106.4576 },
  "University of Science and Technology of China": {
    latitude: 31.8393,
    longitude: 117.2646,
  },
  "Jiaxing University": { latitude: 30.7439, longitude: 120.7194 },
  "Ocean University of China": { latitude: 36.0625, longitude: 120.3355 },
  "Northeastern University": { latitude: 41.7677, longitude: 123.4262 },
  "Lanzhou University": { latitude: 36.0466, longitude: 103.8626 },
  "Yunnan University": { latitude: 25.0605, longitude: 102.7098 },
  "Zhengzhou University": { latitude: 34.8163, longitude: 113.5313 },
  "Fuzhou University": { latitude: 26.0614, longitude: 119.1974 },
  "Nanchang University": { latitude: 28.6588, longitude: 115.7963 },
  "Guangxi University": { latitude: 22.8412, longitude: 108.2926 },
  "Soochow University": { latitude: 31.3053, longitude: 120.6383 },
  "Jiangnan University": { latitude: 31.4787, longitude: 120.2794 },
  "Ningbo University": { latitude: 29.8, longitude: 121.5545 },
  "Wenzhou University": { latitude: 27.9407, longitude: 120.6559 },
};
