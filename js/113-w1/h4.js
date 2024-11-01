var title = "輸入與變數";
var question = "請試著跟不同人打招呼！\n";
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
        input: "Sinyi",
        output: "Hello Sinyi",
        note: ""
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