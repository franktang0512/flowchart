var title = "腳踏車";
var question = "公共腳踏車的計費方式如下：騎乘未滿半小時，以半小時計算。\n";
var array = [
    ["前半小時", "5元"],
    ["半小時後~四小時內", "每半小時10元"],
    ["四小時後~八小時內", "每半小時20元"],
    ["八小時後", "每半小時40元"],	
]
var test_case = [
    {
        input: "4.5",
        output: "95",
        note: "5(半小時)+7*10(四小時之內有7個半小時)+1*20(八小時內有1個半小時) = 95。"
    }
]

$(document).ready(function(){
    $("#question_name").text("題目名稱："+title)
    $("#question_info").text(question);
    $("#example_testcase").append(
        '<tr>\
            <th style="width: 20%;">輸入</th>\
            <th style="width: 20%;">輸出</th>\
            <th style="width: 30%;">說明</th>\
        </tr>'
    )    
    for(let i=0;i<test_case.length;i++){
        $("#example_testcase").append(
            '<tr>\
                <td style="width: 20%;">'+test_case[i].input+'</td>\
                <td style="width: 20%;">'+test_case[i].output+'</td>\
                <td style="width: 30%;">'+test_case[i].note+'</td>\
            </tr>'
        )  
    }
    for(let i=0;i<array.length;i++){
        $("#array").append(
            '<tr>\
                <td style="width: 20%;">'+array[i][0]+'</td>\
                <td style="width: 20%;">'+array[i][1]+'</td>\
            </tr>'
        )  
    }
    
})