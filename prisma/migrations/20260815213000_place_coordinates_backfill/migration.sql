-- Reference coordinates for the places Kondo students study in.
--
-- The migration before this one added the columns; without this one they would
-- be empty in production and Nearby would show no distance at all, which is
-- the feature not working rather than the feature being careful.
--
-- Data, not schema, and deliberately conservative: each statement only touches
-- rows whose coordinates are still NULL, so re-running is a no-op and a value
-- someone has since corrected is never overwritten. Places absent from this
-- list keep NULL and simply show no distance.

UPDATE "City" SET "latitude" = 39.9042, "longitude" = 116.4074 WHERE "name" = 'Beijing' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 31.2304, "longitude" = 121.4737 WHERE "name" = 'Shanghai' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 23.1291, "longitude" = 113.2644 WHERE "name" = 'Guangzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 22.5431, "longitude" = 114.0579 WHERE "name" = 'Shenzhen' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 39.3434, "longitude" = 117.3616 WHERE "name" = 'Tianjin' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 29.563, "longitude" = 106.5516 WHERE "name" = 'Chongqing' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 30.5928, "longitude" = 114.3055 WHERE "name" = 'Wuhan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 30.2741, "longitude" = 120.1551 WHERE "name" = 'Hangzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 32.0603, "longitude" = 118.7969 WHERE "name" = 'Nanjing' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 34.3416, "longitude" = 108.9398 WHERE "name" = 'Xi''an' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 34.3416, "longitude" = 108.9398 WHERE "name" = 'Xian' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 30.5728, "longitude" = 104.0668 WHERE "name" = 'Chengdu' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 30.7522, "longitude" = 120.75 WHERE "name" = 'Jiaxing' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 45.8038, "longitude" = 126.535 WHERE "name" = 'Harbin' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 31.2989, "longitude" = 120.5853 WHERE "name" = 'Suzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 36.0671, "longitude" = 120.3826 WHERE "name" = 'Qingdao' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 38.914, "longitude" = 121.6147 WHERE "name" = 'Dalian' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 24.4798, "longitude" = 118.0894 WHERE "name" = 'Xiamen' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 25.0389, "longitude" = 102.7183 WHERE "name" = 'Kunming' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 28.2282, "longitude" = 112.9388 WHERE "name" = 'Changsha' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 34.7466, "longitude" = 113.6254 WHERE "name" = 'Zhengzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 41.8057, "longitude" = 123.4315 WHERE "name" = 'Shenyang' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 36.6512, "longitude" = 117.1201 WHERE "name" = 'Jinan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 31.8206, "longitude" = 117.2272 WHERE "name" = 'Hefei' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 26.0745, "longitude" = 119.2965 WHERE "name" = 'Fuzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 28.682, "longitude" = 115.8579 WHERE "name" = 'Nanchang' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 26.647, "longitude" = 106.6302 WHERE "name" = 'Guiyang' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 36.0611, "longitude" = 103.8343 WHERE "name" = 'Lanzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 43.8256, "longitude" = 87.6168 WHERE "name" = 'Urumqi' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 22.817, "longitude" = 108.3665 WHERE "name" = 'Nanning' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 38.0428, "longitude" = 114.5149 WHERE "name" = 'Shijiazhuang' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 37.8706, "longitude" = 112.5489 WHERE "name" = 'Taiyuan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 43.8171, "longitude" = 125.3235 WHERE "name" = 'Changchun' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 27.9938, "longitude" = 120.6994 WHERE "name" = 'Wenzhou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 29.8683, "longitude" = 121.544 WHERE "name" = 'Ningbo' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 31.4912, "longitude" = 120.3119 WHERE "name" = 'Wuxi' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 23.0219, "longitude" = 113.1214 WHERE "name" = 'Foshan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 23.0207, "longitude" = 113.7518 WHERE "name" = 'Dongguan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 22.271, "longitude" = 113.5767 WHERE "name" = 'Zhuhai' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 18.2528, "longitude" = 109.5119 WHERE "name" = 'Sanya' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 20.0444, "longitude" = 110.1999 WHERE "name" = 'Haikou' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 29.652, "longitude" = 91.1721 WHERE "name" = 'Lhasa' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 38.4872, "longitude" = 106.2309 WHERE "name" = 'Yinchuan' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 36.6171, "longitude" = 101.7782 WHERE "name" = 'Xining' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "City" SET "latitude" = 40.8414, "longitude" = 111.7519 WHERE "name" = 'Hohhot' AND "latitude" IS NULL AND "longitude" IS NULL;

UPDATE "University" SET "latitude" = 39.999, "longitude" = 116.3059 WHERE "name" = 'Peking University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 40, "longitude" = 116.3264 WHERE "name" = 'Tsinghua University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9707, "longitude" = 116.3157 WHERE "name" = 'Renmin University of China' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9807, "longitude" = 116.3475 WHERE "name" = 'Beihang University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9618, "longitude" = 116.3656 WHERE "name" = 'Beijing Normal University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9614, "longitude" = 116.3164 WHERE "name" = 'Beijing Institute of Technology' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 40.0053, "longitude" = 116.3452 WHERE "name" = 'China Agricultural University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9758, "longitude" = 116.3455 WHERE "name" = 'Beijing Language and Culture University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9906, "longitude" = 116.4247 WHERE "name" = 'University of International Business and Economics' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.9058, "longitude" = 116.5568 WHERE "name" = 'Communication University of China' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.2989, "longitude" = 121.5035 WHERE "name" = 'Fudan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.2016, "longitude" = 121.4269 WHERE "name" = 'Shanghai Jiao Tong University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.2837, "longitude" = 121.5017 WHERE "name" = 'Tongji University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.2276, "longitude" = 121.4074 WHERE "name" = 'East China Normal University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.3168, "longitude" = 121.3924 WHERE "name" = 'Shanghai University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.2649, "longitude" = 120.125 WHERE "name" = 'Zhejiang University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.541, "longitude" = 114.362 WHERE "name" = 'Wuhan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.5122, "longitude" = 114.4128 WHERE "name" = 'Huazhong University of Science and Technology' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 32.0555, "longitude" = 118.7788 WHERE "name" = 'Nanjing University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 32.0562, "longitude" = 118.7869 WHERE "name" = 'Southeast University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 23.0967, "longitude" = 113.2986 WHERE "name" = 'Sun Yat-sen University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 23.1523, "longitude" = 113.3444 WHERE "name" = 'South China University of Technology' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 34.2451, "longitude" = 108.9846 WHERE "name" = 'Xi''an Jiaotong University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 34.2461, "longitude" = 108.9138 WHERE "name" = 'Northwestern Polytechnical University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.6303, "longitude" = 104.0817 WHERE "name" = 'Sichuan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.7539, "longitude" = 103.9345 WHERE "name" = 'University of Electronic Science and Technology of China' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 45.7477, "longitude" = 126.6398 WHERE "name" = 'Harbin Institute of Technology' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 24.4364, "longitude" = 118.0949 WHERE "name" = 'Xiamen University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 36.6749, "longitude" = 117.0576 WHERE "name" = 'Shandong University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.1088, "longitude" = 117.1687 WHERE "name" = 'Tianjin University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 39.1064, "longitude" = 117.1651 WHERE "name" = 'Nankai University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 43.8558, "longitude" = 125.2938 WHERE "name" = 'Jilin University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 38.8814, "longitude" = 121.5271 WHERE "name" = 'Dalian University of Technology' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 28.1683, "longitude" = 112.9354 WHERE "name" = 'Central South University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 28.1806, "longitude" = 112.9455 WHERE "name" = 'Hunan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 29.5657, "longitude" = 106.4576 WHERE "name" = 'Chongqing University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.8393, "longitude" = 117.2646 WHERE "name" = 'University of Science and Technology of China' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 30.7439, "longitude" = 120.7194 WHERE "name" = 'Jiaxing University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 36.0625, "longitude" = 120.3355 WHERE "name" = 'Ocean University of China' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 41.7677, "longitude" = 123.4262 WHERE "name" = 'Northeastern University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 36.0466, "longitude" = 103.8626 WHERE "name" = 'Lanzhou University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 25.0605, "longitude" = 102.7098 WHERE "name" = 'Yunnan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 34.8163, "longitude" = 113.5313 WHERE "name" = 'Zhengzhou University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 26.0614, "longitude" = 119.1974 WHERE "name" = 'Fuzhou University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 28.6588, "longitude" = 115.7963 WHERE "name" = 'Nanchang University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 22.8412, "longitude" = 108.2926 WHERE "name" = 'Guangxi University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.3053, "longitude" = 120.6383 WHERE "name" = 'Soochow University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 31.4787, "longitude" = 120.2794 WHERE "name" = 'Jiangnan University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 29.8, "longitude" = 121.5545 WHERE "name" = 'Ningbo University' AND "latitude" IS NULL AND "longitude" IS NULL;
UPDATE "University" SET "latitude" = 27.9407, "longitude" = 120.6559 WHERE "name" = 'Wenzhou University' AND "latitude" IS NULL AND "longitude" IS NULL;
