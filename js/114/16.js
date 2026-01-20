
var title = "睡眠時間";
var question = "請設計一款睡眠追蹤程式，根據一週的睡眠時間(小時)，計算本週的每日平均睡眠時間（四捨五入）。";
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
        input: "8 6 10 6 7 7 8",
        output: "7",
        note: "本週的睡眠時間分別為8、6、10、6、7、7、8小時，共52小時，平均約為7.43小時"
    },    
    {
        input: "6 6 6 6 6 6 6",
        output: "6",
        note: "本週的睡眠時間分別為6、6、6、6、6、6、6小時，共42小時，平均約為6小時"
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