var title = "獎金";
var question = "公司每月會根據利潤提供獎金給員工：<br><br>利潤低於10萬元(含)的部分，抽取其中20%作為員工獎金；<br>利潤介於100001~20萬元的部分，抽取其中15%作為員工獎金；<br>利潤介於200001~40萬元的部分，抽取其中10%作為員工獎金；<br>利潤介於400001~60萬元的部分，抽取其中5%作為員工獎金；<br>利潤超過600001元的部分，抽取其中3%作為員工獎金；<br><br>請設計計算機，根據公司本月利潤，計算員工獎金。\n";
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
        input: "120000",
        output: "23000",
        note: "100000×20%＝20,000(低於10萬元)。<br>剩下的20,000×15%＝3,000（10萬~20萬）。<br>合計獎金＝20,000+3,000＝23,000。"
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