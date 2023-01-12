/* Inspired by clangmoyai's IINA player script in github !
   This script will add a "Play" button in each scene card.
   Allow you to easily play those video files.
   To use it, just copy and paste the code into Stash->Settings->Interface->Custome Javascript.
   Then refresh the browser.

   Player mode should be either "browser", "browserfull" or "player"
   In browser mode, the video is played within a <video> tag. It works for most platforms.
   In browserfull mode, the video is played in the browser, but in full screen.
   Only works if user permits it.
   In player mode, the video is trying to be sent to an external player.
   Player mode is still buggy, but it should work in android.
   A special use for player mode, is to use Oculus Browser to see the content of Stash,
   then use "Play" to open the scene video quickly.
   This is a great way to view Stash and play scene files in Oculus Quest.
   Most importantly, once a video is played, you can make it full screen, then set the
   immersion mode to be "180" and "3d".
*/

// settings
const debug = false;

const pwPlayer_mode = "browserfull";

function log(str){
	if(debug)console.log(str);
}
log("program starts.");

const pwPlayer_settings = {
	// Path fixes for different OS. For local only.
	"Windows":{
		// Use vlc to handle local files.
		"urlScheme": "vlc://",
		// double backsplashes need 4 backslashes.
		"replacePath": ["\\\\", "/"],
	},
	"Android":{
		// Not used.
		"urlScheme": "file:///",
		"replacePath": ["", ""],
	},
	"iOS":{
		// Not use
		"urlScheme": "file://",
		"replacePath": ["", ""],
	},
	"Linux":{
		// not use
		"urlScheme": "file://",
		"replacePath": ["", ""],
	},
	"MacOS":{
		// For local iina player.
		"urlScheme": "iina://weblink?url=file://",
		// Or VLC: "urlScheme": "vlc-x-callback://x-callback-url/stream?url=file://"
		"replacePath": ["", ""],
	},
	"Oculus":{
		// not use.
		"urlScheme": "file://",
		"replacePath": ["", ""],
	},
	"Others":{
		// not use.
		"urlScheme": "file://",
		"replacePath": ["", ""],
	}
};

// style
const pwPlayer_style = document.createElement("style");
pwPlayer_style.innerHTML = `
    .pwPlayer_button {
        border-radius: 3.5px;
        cursor: pointer;
        padding: 2px 9px 3px 13px;
    }
    .pwPlayer_button:hover {
        background-color: rgba(138, 155, 168, .15);
    }
    .pwPlayer_button svg {
        fill: currentColor;
        width: 1em;
        vertical-align: middle;
    }
    .pwPlayer_button span {
        font-size: 13px;
        font-weight: 500;
        letter-spacing: 0.1em;
        color: currentColor;
        vertical-align: middle;
        margin-left: 3px;
    }
	#pwPlayer_videoDiv{
		background: black;
		position: absolute;
		top: 0px;
		left: 0px;
		width: 100%;
		height: 100%;
		z-index: 1040;
	}
	#pwPlayer_video{
		object-fit: contain;
		object-position: center;
		cursor: pointer;
		position: relative;
		width: 100%;
		height: 100%;
	}
}
`;

// Only need to call once.
const pwPlayer_OS = pwPlayer_getOS();
log("OS: " + pwPlayer_OS);

document.head.appendChild(pwPlayer_style);

// api
const pwPlayer_getSceneDetails = async href => {
    const regex = /\/scenes\/(\d+)\?/,
        sceneId = regex.exec(href)[1],
        graphQl = `
		{
			findScene(id:${sceneId}){
			  files{
				path,
				size,
				format,
				width,
				height,
				duration,
				video_codec,
				audio_codec,
				frame_rate,
			  },
			  date,
			}
		}
		`,
        response = await fetch("/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: graphQl })
        });
    return response.json();
};

const pwPlayer_getSceneInfo = async href => {
    const regex = /\/scenes\/(\d+)\?/,
        sceneId = regex.exec(href)[1],
        graphQl = `{ findScene(id: ${sceneId}) { files { path, basename }, paths{stream} } }`,
        response = await fetch("/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: graphQl })
        });
    return response.json();
};


function pwPlayer_getOS() {
	var uA = window.navigator.userAgent,
	os = "Others";
	switch(true){
		case uA.includes("Win"):
			return "Windows";
		case uA.includes("Mac"):
			return "MacOS";
		case uA.includes("Oculus"):
			return "Oculus";
		case uA.includes("Linux"):
			return "Linux";
		case uA.includes("Android"):
			return "Android";
		case uA.includes("X11"):
			return "Unix";
		default:
			return 'Others';
	}
}

function pwPlayer_getBrowser(){
	// not using this much.
	var userAgent = window.navigator.userAgent;
	
	switch (true){
		case userAgent.includes("OculusBrowser"):
			// special detection for Quest 2.
			return "oculus";
		case userAgent.includes("chrom"):
		case userAgent.includes("crios"):
			return "chrome";
		case userAgent.includes("firefox"):
		case userAgent.includes("fxios"):
			return "firefox";
		case userAgent.includes("safari"):
			return "safari";
		case userAgent.includes("opr"):
			return "opera";
		case userAgent.includes("edg"):
			return "edge";
		default:
			return "others";
	}
}

const pwPlayer_config = { subtree: true, childList: true };
const pwPlayer_previewElm = "video.scene-card-preview-video";
// promise
const pwPlayer_waitForElm = selector => {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }
        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });
        observer.observe(document.body, pwPlayer_config);
    });
};

// initial
pwPlayer_waitForElm(pwPlayer_previewElm).then(() => {
    pwPlayer_addButton();
});

// route
let previousUrl = "";
const observer = new MutationObserver(function (mutations) {
    if (window.location.href !== previousUrl) {
        previousUrl = window.location.href;
        pwPlayer_waitForElm(pwPlayer_previewElm).then(() => {
            pwPlayer_addButton();
        });
    }
});

observer.observe(document, pwPlayer_config);

// main
const pwPlayer_addButton = () => {
    const scenes = document.querySelectorAll("div.row > div");
    for (const scene of scenes) {
        if (scene.querySelector("a.pwPlayer_button") != null) continue;

		const scene_url = scene.querySelector("a.scene-card-link"),
		popover = scene.querySelector("div.card-popovers"),
		button = document.createElement("a");
		button.innerHTML = `
		<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
		<path d="M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm115.7 272-176 
		101c-15.8 8.8-35.7-2.5-35.7-21V152c0-18.4 19.8-29.8 35.7-21l176 107c16.4 9.2 16.4 32.9 0 42z"/></svg>
		<span>Play</span>`;

		button.classList.add("pwPlayer_button");
		button.href = "javascript:;";
		
		button.onclick = () =>{
			pwPlayer_getSceneInfo(scene_url.href)
			.then((result) =>{
				const streamLink = result.data.findScene.paths.stream;
				const filePath = result.data.findScene.files[0].path
					.replace(pwPlayer_settings[pwPlayer_OS].replacePath[0],
						pwPlayer_settings[pwPlayer_OS].replacePath[1]);

				if (pwPlayer_mode === "browser"){
					// normal browser mode
					playVideoInBrowser(streamLink);
				}else if(pwPlayer_mode === "browserfull"){
					// fullscreen browser mode
					playVideoInBrowser(streamLink, true);
				}else if(pwPlayer_mode === "player"){
					switch (pwPlayer_OS){
						case "Mac OS":
							// Sample local handling for iina player.
							// if you don't have iina player, use "remote" mode instead.
							if(debug)alert("you just click play in MacOS");
							if (pwPlayer_mode == "player"){
								href = pwPlayer_settings.MacOS.urlScheme +
									pwPlayer_settings.MacOS.replacePath[1] +
									encodeURIComponent(filePath);
								window.open(href);
							}
							break;
						case "Android":
							// Special andoid launch with intent
							if (button.href == "javascript:;"){
								url = new URL(streamLink);
								const scheme=url.protocol.slice(0,-1);
								url.hash = `Intent;action=android.intent.action.VIEW;scheme=${scheme};type=video/mp4;S.title=${encodeURI(
									result.data.findScene.files[0].basename
									)};end`;
								url.protocol = "intent";
								button.href = url.toString();
								button.click();
							}
							break;

						case "iOS":
							// Special ios launch
							if( button.href == "javascript:;"){
								url = new URL();
								url.host = "x-callback-url";
								url.port = "";
								url.pathname = "stream";
								url.search = `url=${encodeURIComponent(streamLink)}`;
								url.protocol = "vlc-x-callback";
								button.href = url.toString();
								button.click();
							}
							break;
						case "Oculus":
							// use browser built-in player
							if (button.href == "javascript:;"){
								button.href = streamLink;
								button.click();
							}
							break;
						case "Windows":
							if(debug)alert("you just click play in Windows");
							if (pwPlayer_mode == "player"){
								settings = pwPlayer_settings.Windows;
								href = settings.urlScheme + encodeURIComponent(filePath);
								window.open(href);
							}
							break;
						default:
					} // end of the switch
				} // end of player mode
			});

		};	// end of button onclick envent.

		if (popover) popover.append(button);

		button.onmouseover = () => {
			if (button.title.length == 0) {
				pwPlayer_getSceneDetails(scene_url.href)
					.then((result) => {
						// console.log("result: " + JSON.stringify(result));
						data = result.data.findScene;
						sceneFile = data.files[0];
						// log("before title phase.")
						title =`Path: ${ WrapStr(sceneFile.path,30)}
Size: ${niceBytes(sceneFile.size)}
Dimensions: ${sceneFile.width}x${sceneFile.height}
Duration: ${toHMS(sceneFile.duration)}
Codecs: ${sceneFile.video_codec}, ${sceneFile.audio_codec}
Frame Rate: ${sceneFile.frame_rate}
${data.date?"Date: "+data.date : ""}`;
						log("title:" + title);
						button.title = title;
					});
			}
		};	// end of on mouse move over.
        
    }; // end of the each scene card loop.
};	// end of pwPlayer_addButton function.

function WrapStr(s,n){
	// 
	if (s.length <= n) return s;
	str = s.substr(0,n)
	for (i=n;i<s.length;i+=n){
		str += "\n        " + s.substr(i,n)
	}
	return str
}

function toHMS(s){
	f=Math.floor;
	g=(n)=>('00'+n).slice(-2);
	return f(s/3600)+':'+g(f(s/60)%60)+':'+g(s%60);
}
   
function niceBytes(x){
	let units = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let l = 0, n = parseInt(x, 10) || 0;
	while(n >= 1024 && ++l){ n = n/1024; }
	return(n.toFixed(n < 10 && l > 0 ? 1 : 0) + ' ' + units[l]);
}

function playVideoInBrowser(streamLink, fullscreen = false){
	var pwPlayer_video_div = document.createElement("div");

	pwPlayer_video_div.id = "pwPlayer_videoDiv";
	var pwPlayer_video = document.createElement("video");
	pwPlayer_video.id = "pwPlayer_video";
	pwPlayer_video.autoplay = true;
	pwPlayer_video.controls = true;
	pwPlayer_video.src = streamLink;
	pwPlayer_video_div.appendChild(pwPlayer_video);
	var pwPlayer_divNode = document.body.insertBefore(pwPlayer_video_div, document.body.firstChild);
	pwPlayer_video_div.width =window.innerWidth;
	pwPlayer_video_div.height =window.innerHeight;

	log("win inner w:" + window.innerWidth);
	log("win inner h: "+ window.innerHeight);
	log("div width:" + pwPlayer_video_div.width);
	log("div height:" + pwPlayer_video_div.height); 

	// save the scroll postion.
	var pwPlayer_scrollPos;
	if (typeof window.pageYOffset != 'undefined') {
		pwPlayer_scrollPos = window.pageYOffset;
	}
	else if (typeof document.compatMode != 'undefined' && document.compatMode != 'BackCompat') {
		pwPlayer_scrollPos = document.documentElement.scrollTop;
	}
	else if (typeof document.body != 'undefined') {
		pwPlayer_scrollPos = document.body.scrollTop;
	}
	log("scroll pos:" + pwPlayer_scrollPos);

	window.scrollTo(0,0);

	// now make it full screen if enabled
	if (fullscreen){
		doFullScreen();
		pwPlayer_video.height = screen.height;
		pwPlayer_video.width = screen.width;

	}

	// track mouse y position
	var pwPlayer_mouseY = 0;
	document.onmousemove = (e) => {
		pwPlayer_mouseY = e.clientY;
	}

	let pwPwPlayer_videoEnd = () =>{
		// all video will call this to end.
		pwPlayer_video.pause();
		document.body.removeChild(pwPlayer_divNode);
		window.scrollTo(0, pwPlayer_scrollPos);
	}

	pwPlayer_video.onerror = () => {
		alert("Error playing this video.");
		log("Error in playing, scroll pos:" + pwPlayer_scrollPos);
		pwPwPlayer_videoEnd();
	}

	pwPlayer_video.onended = () => {
		if(inFullScreen()){
			exitFullscreen();
		}
		// normal ending
		log("video reach the end.");
		pwPwPlayer_videoEnd();
	}

	pwPlayer_video.onpause = (event) => {
		if(inFullScreen()){
			// in fullscreen mode, mouse in the bottom 1/5, do nothing.
			if ( (screen.height - pwPlayer_mouseY)<(screen.height/5) ){
				return;
			}else{
				// exit full screen and prepare to be deleted.
				exitFullscreen();
				pwPwPlayer_videoEnd();
				return;
			}
		}
		// normal video process.
		var rect = event.target.getBoundingClientRect();
		var y = rect.top + rect.height - pwPlayer_mouseY;
		log("client Y:" + pwPlayer_mouseY + " y:" + y + ' rect h:' + rect.height);
		if ( Math.abs(y) < rect.height / 5 ) return;

		log("play ends, scroll pos:" + pwPlayer_scrollPos);
		pwPwPlayer_videoEnd();
	}
}

function doFullScreen() {
    var element = document.documentElement;
    // Check which implementation is available
    var requestMethod = element.requestFullScreen ||
              element.webkitRequestFullScreen ||
              element.mozRequestFullScreen ||
              element.msRequestFullscreen;

    if( requestMethod ) {
		// log("fullscreen method found: " + requestMethod);
      requestMethod.apply( element );
    }else{
		// log("fullscreen method not found");
	}
	;

}

function exitFullscreen(){
    var element = document;
    // Check which implementation is available
    var requestMethod = element.exitFullScreen ||
              element.webkitExitFullscreen ||
              element.mozCancelFullScreen ||
              element.msExitFullscreen;

    if( requestMethod ) {
		log ("have method to exit full screen." + requestMethod.toString());
		requestMethod.apply( element );
    }else{
		log ("no method to exit full screen.");
	}
}

function inFullScreen(){
	var doc = window.document;
	return !(!doc.fullscreenElement 
		&& !doc.mozFullScreenElement 
		&& !doc.webkitFullscreenElement 
		&& !doc.msFullscreenElement);
}