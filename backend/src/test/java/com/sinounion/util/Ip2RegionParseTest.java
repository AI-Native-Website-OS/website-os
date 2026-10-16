package com.sinounion.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * ip2region 区划字符串解析：只保留 国家/省份/城市，不把 ISP（电信/联通/移动）写进城市。
 */
class Ip2RegionParseTest {

    @Test
    void builtinSchemaKeepsProvinceAndCityWithoutIsp() {
        // 本内置库格式：国家|省份|城市|ISP|国家代码
        String[] loc = IpLocationService.parseIp2Region("中国|天津市|天津市|电信|CN");
        assertEquals("中国", loc[0]);
        assertEquals("天津市", loc[1]);
        assertEquals("天津市", loc[2]);
    }

    @Test
    void standardSchemaIsAlsoSupported() {
        // 标准 ip2region 格式：国家|区域|省份|城市|ISP
        String[] loc = IpLocationService.parseIp2Region("中国|0|江苏省|南京市|中国电信");
        assertEquals("中国", loc[0]);
        assertEquals("江苏省", loc[1]);
        assertEquals("南京市", loc[2]);
    }

    @Test
    void ispNeverLeaksIntoCity() {
        String[] loc = IpLocationService.parseIp2Region("中国|天津市|天津市|电信|CN");
        org.junit.jupiter.api.Assertions.assertNotEquals("电信", loc[2]);
        org.junit.jupiter.api.Assertions.assertNotEquals("联通", loc[2]);
    }

    @Test
    void reservedRangeBecomesEmpty() {
        String[] loc = IpLocationService.parseIp2Region("Reserved|Reserved|Reserved|0|0");
        assertEquals("", loc[0]);
        assertEquals("", loc[1]);
        assertEquals("", loc[2]);
    }

    @Test
    void threeFieldVariantSupported() {
        String[] loc = IpLocationService.parseIp2Region("中国|广东省|深圳市");
        assertEquals("中国", loc[0]);
        assertEquals("广东省", loc[1]);
        assertEquals("深圳市", loc[2]);
    }

    @Test
    void nullAndEmptyAreSafe() {
        assertEquals("", IpLocationService.parseIp2Region(null)[0]);
        assertEquals("", IpLocationService.parseIp2Region("")[0]);
    }
}
