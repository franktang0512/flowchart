var title = "超速";
var question = "社區道路上設有測速照相，時速限制為30(km/h)，時速超過(不包含)30(km/h)為超速。請根據每輛車的時速，計算今日有幾輛車超速。(-1代表今日結束)";
var array = [
    /*["夜市牛排", "200"],
    ["藥燉排骨", "120"],
    ["炸雞排", "60"],
    ["奶茶", "55"],
    ["臭豆腐", "40"],
    ["地瓜球", "30"]*/
]
var test_case = [
    {
        input: "20 27 60 -1",
        output: "1",
        note: "車輛時速分別為20、27、60(km/h)，共有1輛車超速。"
    },
	{
        input: "25 70 62 47 -1",
        output: "3",
        note: "車輛時速分別為25、70、62、47(km/h)，共有3輛車超速。"
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