package com.sinounion.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;

@Data
public class FooterConfigDTO {

    @Size(max = 500, message = "Logo图片地址最多500字")
    private String logo;

    @Size(max = 200, message = "版权信息最多200字")
    private String copyright;

    @Size(max = 500, message = "公安图标地址最多500字")
    private String policeIcon;

    @Size(max = 100, message = "ICP备案号最多100字")
    private String icpNumber;

    @Size(max = 500, message = "ICP备案链接最多500字")
    private String icpUrl;

    @Size(max = 100, message = "公安备案号最多100字")
    private String policeNumber;

    @Size(max = 500, message = "公安备案链接最多500字")
    private String policeUrl;

    @Valid
    private List<FooterExtraItem> extra = new ArrayList<>();

    @Valid
    private List<FooterQrcodeItem> qrcodes = new ArrayList<>();

    @Valid
    private List<FooterLinkItem> links = new ArrayList<>();

    @Data
    public static class FooterExtraItem {

        @Size(max = 5, message = "其他内容标签最多5字")
        private String label;

        @Size(max = 200, message = "其他内容最多200字")
        private String value;
    }

    @Data
    public static class FooterQrcodeItem {

        @Size(max = 500, message = "二维码图片地址最多500字")
        private String image;

        @Size(max = 50, message = "二维码标签最多50字")
        private String label;
    }

    @Data
    public static class FooterLinkItem {

        @Size(max = 10, message = "友情链接名称最多10字")
        private String name;

        @Size(max = 500, message = "友情链接地址最多500字")
        private String url;
    }
}
