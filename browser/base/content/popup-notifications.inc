# to be included inside a popupset element

    <panel id="notification-popup"
           type="arrow"
           footertype="promobox"
           position="after_start"
           hidden="true"
           orient="vertical"
           role="alert"/>

    <popupnotification id="webRTC-shareDevices-notification" hidden="true">
      <popupnotificationcontent id="webRTC-selectCamera" orient="vertical">
        <separator class="thin"/>
        <label value="&getUserMedia.selectCamera.label;"
               accesskey="&getUserMedia.selectCamera.accesskey;"
               control="webRTC-selectCamera-menulist"/>
        <menulist id="webRTC-selectCamera-menulist">
          <menupopup id="webRTC-selectCamera-menupopup"/>
        </menulist>
      </popupnotificationcontent>
      <popupnotificationcontent id="webRTC-selectMicrophone" orient="vertical">
        <separator class="thin"/>
        <label value="&getUserMedia.selectMicrophone.label;"
               accesskey="&getUserMedia.selectMicrophone.accesskey;"
               control="webRTC-selectMicrophone-menulist"/>
        <menulist id="webRTC-selectMicrophone-menulist">
          <menupopup id="webRTC-selectMicrophone-menupopup"/>
        </menulist>
      </popupnotificationcontent>
    </popupnotification>

    <popupnotification id="geolocation-notification" hidden="true">
      <popupnotificationcontent orient="vertical" align="start">
        <separator class="thin"/>
        <label id="geolocation-learnmore-link" class="text-link"/>
      </popupnotificationcontent>
    </popupnotification>

    <popupnotification id="interests-notification" hidden="true">
      <popupnotificationcontent orient="vertical" align="start">
        <separator class="thin"/>
        <label id="interests-privacy" value="&interests.privacy;"/>
        <label id="interests-learnmore-link" value="&interests.learnMore;" href="about:profile" class="text-link"/>
      </popupnotificationcontent>
    </popupnotification>

    <popupnotification id="servicesInstall-notification" hidden="true">
      <popupnotificationcontent orient="vertical" align="start">
        <separator class="thin"/>
        <label id="servicesInstall-learnmore-link" class="text-link"/>
      </popupnotificationcontent>
    </popupnotification>

    <popupnotification id="pointerLock-notification" hidden="true">
      <popupnotificationcontent orient="vertical" align="start">
        <separator class="thin"/>
        <label id="pointerLock-cancel" value="&pointerLock.notification.message;"/>
      </popupnotificationcontent>
    </popupnotification>

    <popupnotification id="mixed-content-blocked-notification" hidden="true">
      <popupnotificationcontent orient="vertical" align="start">
        <separator/>
        <description id="mixed-content-blocked-moreinfo">&mixedContentBlocked.moreinfo;</description>
        <separator/>
        <label id="mixed-content-blocked-helplink" class="text-link"
               value="&mixedContentBlocked.helplink;"/>
      </popupnotificationcontent>
    </popupnotification>
