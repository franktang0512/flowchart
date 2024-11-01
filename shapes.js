var Figures={
    Rectangle:function(ctx,node,color){
        ctx.strokeStyle=color;
        ctx.beginPath();
        ctx.moveTo(node.x, node.y+node.h);
        ctx.lineTo(node.x+node.w, node.y+node.h);
        ctx.lineTo(node.x+node.w, node.y);
        ctx.lineTo(node.x, node.y);
        ctx.closePath();
        ctx.stroke();
        ctx.font="20px Verdana";
        ctx.textBaseline="middle";
        node.textfill(ctx);
    },
    Function:function(ctx,node,color){
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x, node.y+node.h);
        ctx.lineTo(node.x+node.w, node.y+node.h);
        ctx.lineTo(node.x+node.w, node.y);
        ctx.lineTo(node.x, node.y);
        ctx.lineTo(node.x, node.y+node.h);
        ctx.moveTo(node.x+node.w*0.1, node.y+node.h);
        ctx.lineTo(node.x+node.w*0.9, node.y+node.h);
        ctx.lineTo(node.x+node.w*0.9, node.y);
        ctx.lineTo(node.x+node.w*0.1, node.y);
        ctx.closePath();
        ctx.stroke();
        ctx.font="20px Verdana";
        ctx.textBaseline="middle";
        node.textfill(ctx);
    },
    Circle:function(ctx,node,color){
        const step = (node.w > node.h) ? 1/node.w : 1/node.h;
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x + node.w, node.y + node.h/2);
        for (let i = 0; i < 2 * Math.PI; i += step) {
            ctx.lineTo(node.x + node.w/2 + node.w/2 * Math.cos(i), node.y + node.h/2 + node.h/2 * Math.sin(i));
        }
        ctx.closePath();
        ctx.stroke();
        node.textfill(ctx);
    },
    Diamond:function(ctx,node,color){
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x,node.y+node.h/2);
        ctx.lineTo(node.x+node.w/2,node.y);
        ctx.lineTo(node.x+node.w,node.y+node.h/2);
        ctx.lineTo(node.x+node.w/2,node.y+node.h);
        ctx.closePath();
        ctx.stroke();
        node.textfill(ctx);
    },
    For_Loop:function(ctx,node,color){
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x,node.y+node.h/2);
        ctx.lineTo(node.x+node.w/3,node.y);
		ctx.lineTo(node.x+node.w*2/3,node.y);
        ctx.lineTo(node.x+node.w,node.y+node.h/2);
		ctx.lineTo(node.x+node.w*2/3,node.y+node.h);
        ctx.lineTo(node.x+node.w/3,node.y+node.h);
        ctx.closePath();
        ctx.stroke();
		
		ctx.beginPath();
		const step = (node.w > node.h) ? 1/node.w : 1/node.h;
		ctx.moveTo(node.x + 0.5*node.w + 0.3*node.w * Math.cos(0.1*Math.PI), node.y + node.h/2 + 0.4*node.h * Math.sin(0.1*Math.PI));
        for (let i = 0.1*Math.PI; i < 2 * Math.PI; i += step) {
            ctx.lineTo(node.x +  node.w/2 +  0.6*node.w/2 * Math.cos(i), node.y + node.h/2 + 0.4*node.h * Math.sin(i));
        }
		ctx.stroke();
		ctx.beginPath();
		ctx.lineTo(node.x + 0.8*node.w+8, node.y + 0.5*node.h-10);
		ctx.lineTo(node.x + 0.8*node.w, node.y + 0.5*node.h);
		ctx.lineTo(node.x + 0.8*node.w-8, node.y + 0.5*node.h-10);
		ctx.lineTo(node.x + 0.8*node.w+8, node.y + 0.5*node.h-10);
		ctx.stroke();
		ctx.fill();
		
        node.textfill(ctx);
    },
	While_Loop:function(ctx,node,color){
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x,node.y+node.h/2);
        ctx.lineTo(node.x+node.w/3,node.y);
		ctx.lineTo(node.x+node.w*2/3,node.y);
        ctx.lineTo(node.x+node.w,node.y+node.h/2);
		ctx.lineTo(node.x+node.w*2/3,node.y+node.h);
        ctx.lineTo(node.x+node.w/3,node.y+node.h);
        ctx.closePath();
        ctx.stroke();
        node.textfill(ctx);
    },
    Parallelogram:function(ctx,node,color){
        ctx.beginPath();
        ctx.strokeStyle=color;
        ctx.moveTo(node.x-10, node.y+node.h);
        ctx.lineTo(node.x+node.w-10, node.y+node.h);
        ctx.lineTo(node.x+node.w+10, node.y);
        ctx.lineTo(node.x+10, node.y);
        ctx.closePath();
        ctx.stroke();
        node.textfill(ctx);
        
    }
}




var node_model = {
    Circle: '<p id="hint">請選擇開始或結束</p>\
                <input type="radio" name="radio" value="開始" checked>開始\
                <input type="radio" name="radio" value="結束">結束\
                <br><button id="hint_yes">確認</button>\
                <button id="hint_no">取消</button>'
    ,
    Parallelogram:  '<input type="radio" name="radio" value="輸入" checked onclick="$(\'#io_text\').text(\'變數：\');$(\'#var_select\').css(\'display\', \'block\');$(\'#var_select_output\').val(\'\');$(\'#var_select_output\').css(\'display\', \'none\');">輸入\
                <input type="radio" name="radio" value="輸出" onclick="$(\'#io_text\').text(\'變數或字串：\');$(\'#var_select\').css(\'display\', \'none\');$(\'#var_select\').val(\'\');$(\'#var_select_output\').css(\'display\', \'block\');">輸出\
                <br><br><p id="io_text">變數：<\p><input class="var_select" id="var_select"></input><input class="var_select" id="var_select_output" style="display: none;"></input>\
                <br><br><button id="hint_yes">確認</button>\
                <button id="hint_no">取消</button>'
    ,
    Diamond: '<p id="hint">請輸入邏輯判斷式，and, or, not < > = </p>\
            <input id="code" style="width: 80%"></input>\
            <br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
	Loop: '<p id="hint">離開迴圈的條件是？</p>\
            <input type="radio" name="radio" value="for" checked onclick="$(\'#while_div\').css(\'display\', \'none\'); $(\'#for_div\').css(\'display\', \'block\');">執行完幾次\
            <input type="radio" name="radio" value="while" onclick="$(\'#while_div\').css(\'display\', \'block\'); $(\'#for_div\').css(\'display\', \'none\');">達成某個條件\
            <br><br>\
            <div id="while_div" style="display:none;">\
                <p id="hint">請輸入邏輯判斷式，and, or, not < > = </p>\
                <input id="code" style="width: 80%"></input>\
            </div>\
            <div id="for_div" style="display:block;">\
                <p id="hint">請輸入次數</p>\
                <input id="for_number" style="width: 80%"></input>\
            </div>\
            <br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
    For_Loop: '<p id="hint">離開迴圈的條件是？</p>\
            <input type="radio" name="radio" value="for" checked onclick="$(\'#while_div\').css(\'display\', \'none\'); $(\'#for_div\').css(\'display\', \'block\');">執行完幾次\
            <input type="radio" name="radio" value="while" onclick="$(\'#while_div\').css(\'display\', \'block\'); $(\'#for_div\').css(\'display\', \'none\');">達成某個條件\
            <br><br>\
            <div id="while_div" style="display:none;">\
                <p id="hint">請輸入邏輯判斷式，and, or, not < > = </p>\
                <input id="code" style="width: 80%"></input>\
            </div>\
            <div id="for_div" style="display:block;">\
                <p id="hint">請輸入次數</p>\
                <input id="for_number" style="width: 80%"></input>\
            </div>\
            <br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
	While_Loop: '<p id="hint">離開迴圈的條件是？</p>\
            <input type="radio" name="radio" value="for" checked onclick="$(\'#while_div\').css(\'display\', \'none\'); $(\'#for_div\').css(\'display\', \'block\');">執行完幾次\
            <input type="radio" name="radio" value="while" onclick="$(\'#while_div\').css(\'display\', \'block\'); $(\'#for_div\').css(\'display\', \'none\');">達成某個條件\
            <br><br>\
            <div id="while_div" style="display:none;">\
                <p id="hint">請輸入邏輯判斷式，and, or, not < > = </p>\
                <input id="code" style="width: 80%"></input>\
            </div>\
            <div id="for_div" style="display:block;">\
                <p id="hint">請輸入次數</p>\
                <input id="for_number" style="width: 80%"></input>\
            </div>\
            <br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
    Function: '<p id="hint">請說明步驟內要做什麼？</p>\
            <input id="doing_something" style="width: 80%"></input>\
            <br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
    Rectangle:  '<p id="hint">將變數內的值設為...</p>\
            <br>變數：<input class="var_select" id="var_select" style="width: 50%"></input><br><br> 設為 <input id="code" style="width: 80%"></input>\
            <br><br><p>捨去進位？\
			<input type="radio" name="radio" value="" checked >不需要\
            <input type="radio" name="radio" value="Math.round">四捨五入\
			<br><input type="radio" name="radio" value="Math.floor">無條件捨去\
            <input type="radio" name="radio" value="Math.ceil">無條件進位\
			<\p><br><button id="hint_yes">確認</button>\
            <button id="hint_no">取消</button>'
    ,
	link_tf:  '<p id="hint">請選擇</p>\
                <input type="radio" name="radio" value="真" checked>真\
                <input type="radio" name="radio" value="假">假\
                <br><button id="hint_yes">確認</button>\
                <button id="hint_no">取消</button>'
    ,
	link_for:  '<p id="hint">請選擇</p>\
                <input type="radio" name="radio" value="進入迴圈" checked>進入迴圈\
                <input type="radio" name="radio" value="離開迴圈">離開迴圈\
                <br><button id="hint_yes">確認</button>\
                <button id="hint_no">取消</button>'
    ,
	clear:  '<p id="hint">將清空流程圖</p>\
                <br><button id="hint_yes">確認</button>\
                <button id="hint_no">取消</button>'
    ,
}
